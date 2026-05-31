package io.github.netherdeck.gradle

import io.github.netherdeck.gradle.extension.NetherDeckExtension
import io.github.netherdeck.gradle.runnable.FileDownloader
import io.github.netherdeck.gradle.runnable.SpigotBuilder
import io.github.netherdeck.gradle.tasks.ProcessMappingTask
import io.github.netherdeck.gradle.tasks.RemapSpigotTask
import io.github.netherdeck.gradle.tasks.RenameJarTask
import net.fabricmc.loom.LoomGradlePlugin
import net.fabricmc.loom.configuration.mods.dependency.LocalMavenHelper
import org.apache.commons.io.FileUtils
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.apache.commons.io.IOUtils

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

class NetherDeckGradlePlugin implements Plugin<Project> {

    @Override
    void apply(Project project) {
        def netherdeck = project.extensions.create('netherdeck', NetherDeckExtension, project)

        def localRepo = netherdeck.cacheDir.resolve('netherdeck_repo')
        project.repositories.maven {
            name = 'NetherDeck Spigot Repo'
            url = localRepo
        }

        def mappingsDir = netherdeck.cacheDir.resolve('netherdeck_cache/mappings')
        def forgeMappings = mappingsDir.resolve('bukkit_srg.srg').toFile()
        def forgeInheritance = mappingsDir.resolve('inheritanceMap.txt').toFile()
        def reobfMappings = mappingsDir.resolve('reobf_bukkit.srg').toFile()
        def neoforgeMappings = mappingsDir.resolve('bukkit_moj.srg').toFile()
        def fabricMappings = mappingsDir.resolve('bukkit_intermediary.srg').toFile()
        def fabricInheritance = mappingsDir.resolve('inheritanceMap_intermediary.txt').toFile()
        netherdeck.mappingsConfiguration.bukkitToForge = forgeMappings
        netherdeck.mappingsConfiguration.reobfBukkitPackage = reobfMappings
        netherdeck.mappingsConfiguration.bukkitToForgeInheritance = forgeInheritance
        netherdeck.mappingsConfiguration.bukkitToNeoForge = neoforgeMappings
        netherdeck.mappingsConfiguration.bukkitToFabric = fabricMappings
        netherdeck.mappingsConfiguration.bukkitToFabricInheritance = fabricInheritance

        project.tasks.register('relocateCraftBukkit', RenameJarTask) {
            it.dependsOn project.tasks.remapJar
            inputJar.set project.tasks.remapJar.archiveFile
            archiveClassifier.set 'relocated'
            mappings = netherdeck.mappingsConfiguration.reobfBukkitPackage
        }
        project.tasks.build.dependsOn('relocateCraftBukkit')

        project.afterEvaluate {
            setupSpigot(project, localRepo)
        }
    }

    private static def setupSpigot(Project project, Path localRepo) {
        def netherdeck = project.extensions.getByName('netherdeck') as NetherDeckExtension


        def mappingsDir = netherdeck.cacheDir.resolve('netherdeck_cache/mappings')

        def spigotDeps = localRepo.resolve("io/github/netherdeck/generated/spigot/${netherdeck.mcVersion}")
        def spigotMapped = spigotDeps.resolve("spigot-${netherdeck.mcVersion}-mapped.jar")
        def spigotDeobf = spigotDeps.resolve("spigot-${netherdeck.mcVersion}-deobf.jar")

        def buildMeta = netherdeck.cacheDir.resolve('spigot_version.json')
        def rev = netherdeck.mcVersion
        if (netherdeck.spigotReversion) {
            rev = netherdeck.spigotReversion
        }

        project.logger.lifecycle("Setup for Spigot ${netherdeck.mcVersion}(${netherdeck.spigotReversion})")
        def newBuildMeta = IOUtils.toString(new URI("https://hub.spigotmc.org/versions/${rev}.json").toURL(), StandardCharsets.UTF_8)
        if (Files.exists(buildMeta)) {
            var built = Files.readString(buildMeta)
            if (built == newBuildMeta) {
                if (netherdeck.mappingsConfiguration.areMappingsExist()
                        && Files.exists(spigotDeobf)) {
                    project.logger.lifecycle(":spigot build cache valid, using it")
                    project.logger.debug(built)
                    return
                }
            }
        }

        def buildSpigotWorkDir = netherdeck.cacheDir.resolve('netherdeck_cache/buildtools')

        FileUtils.deleteDirectory(buildSpigotWorkDir.toFile())
        Files.createDirectories(buildSpigotWorkDir)

        project.logger.lifecycle(":step1 download build tools")
        def buildToolsJar = buildSpigotWorkDir.resolve('BuildTools.jar')
        def downloadBuildTools = new FileDownloader("https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar", buildToolsJar)
        downloadBuildTools.run()

        project.logger.lifecycle(":step2 build spigot")
        def spigotBuilder = project.getObjects().newInstance(SpigotBuilder)
        spigotBuilder.buildToolsJar = buildToolsJar
        spigotBuilder.workDir = buildSpigotWorkDir
        spigotBuilder.outputDir = spigotDeps
        spigotBuilder.minecraftVersion = netherdeck.mcVersion
        spigotBuilder.reversion = netherdeck.spigotReversion
        spigotBuilder.run()

        new LocalMavenHelper("io.github.netherdeck.generated", "spigot", netherdeck.mcVersion, null, localRepo).savePom()

        project.logger.lifecycle(":step3 process mappings")
        def processMapping = new ProcessMappingTask(project)
        processMapping.buildData = new File(buildSpigotWorkDir.toFile(), 'BuildData')
        processMapping.mcVersion = netherdeck.mcVersion
        processMapping.bukkitVersion = netherdeck.bukkitVersion
        processMapping.outDir = mappingsDir.toFile()
        processMapping.inJar = spigotBuilder.outputJar.toFile()
        processMapping.run()

        project.logger.lifecycle(":step4 remap spigot jar")
        def remapSpigot = new RemapSpigotTask(project)
        remapSpigot.ssJar = new File(buildSpigotWorkDir.toFile(), 'BuildData/bin/SpecialSource.jar')
        remapSpigot.inJar = spigotBuilder.outputJar.toFile()
        remapSpigot.inSrg = new File(processMapping.outDir, 'bukkit_srg.srg')
        remapSpigot.inSrgToStable = new File(processMapping.outDir, "srg_to_named.srg")
        remapSpigot.inheritanceMap = new File(processMapping.outDir, 'inheritanceMap.txt')
        remapSpigot.outJar = project.file(spigotMapped)
        remapSpigot.outDeobf = project.file(spigotDeobf)
        remapSpigot.inAt = netherdeck.accessTransformer
        remapSpigot.bukkitVersion = netherdeck.bukkitVersion
        remapSpigot.inExtraSrg = netherdeck.extraMapping
        remapSpigot.run()

        Files.writeString(buildMeta, newBuildMeta)
    }
}
