package io.github.netherdeck.gradle.tasks

import groovy.json.JsonOutput
import io.github.netherdeck.gradle.Utils
import org.gradle.api.DefaultTask
import org.gradle.api.artifacts.Configuration
import org.gradle.api.artifacts.DependencyArtifact
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

import java.nio.file.Files

class GenerateInstallerInfo extends DefaultTask {

    private String minecraftVersion, forgeVersion, neoforgeVersion, fabricLoaderVersion
    private Configuration configuration, fabricExtra

    @Classpath
    Configuration getConfiguration() {
        return configuration
    }

    void setConfiguration(Configuration configuration) {
        this.configuration = configuration
    }

    @Classpath
    Configuration getFabricExtra() {
        return fabricExtra
    }

    void setFabricExtra(Configuration fabricExtra) {
        this.fabricExtra = fabricExtra
    }

    @Input
    String getMinecraftVersion() {
        return minecraftVersion
    }

    void setMinecraftVersion(String minecraftVersion) {
        this.minecraftVersion = minecraftVersion
    }

    @Input
    String getForgeVersion() {
        return forgeVersion
    }

    void setForgeVersion(String forgeVersion) {
        this.forgeVersion = forgeVersion
    }

    @Input
    String getNeoforgeVersion() {
        return neoforgeVersion
    }

    void setNeoforgeVersion(String neoforgeVersion) {
        this.neoforgeVersion = neoforgeVersion
    }

    @Input
    String getFabricLoaderVersion() {
        return fabricLoaderVersion
    }

    void setFabricLoaderVersion(String fabricLoaderVersion) {
        this.fabricLoaderVersion = fabricLoaderVersion
    }

    private static List<String> configurationDeps(Configuration conf) {
        return conf.dependencies.collect { dep ->
            def classifier = null
            if (dep.artifacts) {
                dep.artifacts.each { DependencyArtifact artifact ->
                    if (artifact.classifier) {
                        classifier = artifact.classifier
                    }
                }
            }
            if (classifier) {
                return "${dep.group}:${dep.name}:${dep.version}:$classifier"
            } else {
                return "${dep.group}:${dep.name}:${dep.version}"
            }
        } as List<String>
    }

    /**
     * Download an installer JAR with caching. Returns the SHA1 hash on success,
     * or "UNAVAILABLE" if the download fails (with a logged warning).
     */
    private static String downloadAndHash(String label, String url) {
        try {
            def tmp = Files.createTempFile(label, ".jar")
            Utils.downloadCached(url, tmp.toFile())
            def hash = Utils.sha1(tmp.toFile())
            Files.deleteIfExists(tmp)
            return hash
        } catch (Exception e) {
            System.err.println("[NetherDeck] WARNING: Failed to download ${label} installer from ${url}")
            System.err.println("[NetherDeck]   Cause: ${e.message}")
            System.err.println("[NetherDeck]   The ${label} platform JAR will need manual verification at runtime.")
            return "UNAVAILABLE"
        }
    }

    @TaskAction
    void run() {
        def libs = configurationDeps(this.configuration)
        def fabricLibs = configurationDeps(this.fabricExtra)
        def artifacts = { List<String> arts ->
            def ret = new HashMap<String, String>()
            def cfg = project.configurations.create("art_rev_" + System.currentTimeMillis())
            cfg.transitive = false
            arts.each {
                def dep = project.dependencies.create(it)
                cfg.dependencies.add(dep)
            }
            cfg.resolve()
            cfg.resolvedConfiguration.resolvedArtifacts.each { rev ->
                def art = [
                        group     : rev.moduleVersion.id.group,
                        name      : rev.moduleVersion.id.name,
                        version   : rev.moduleVersion.id.version,
                        classifier: rev.classifier,
                        extension : rev.extension,
                        file      : rev.file
                ]
                def desc = "${art.group}:${art.name}:${art.version}"
                if (art.classifier != null)
                    desc += ":${art.classifier}"
                if (art.extension != 'jar')
                    desc += "@${art.extension}"
                ret.put(desc.toString(), Utils.sha1(art.file))
            }
            return arts.collectEntries { [(it.toString()): ret.get(it.toString())] }
        }

        def forgeHash = downloadAndHash("forge",
                "https://files.minecraftforge.net/maven/net/minecraftforge/forge/$minecraftVersion-$forgeVersion/forge-$minecraftVersion-$forgeVersion-installer.jar")
        def neoforgeHash = downloadAndHash("neoforge",
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/$neoforgeVersion/neoforge-$neoforgeVersion-installer.jar")
        def fabricHash = downloadAndHash("fabric-loader",
                "https://maven.fabricmc.net/net/fabricmc/fabric-loader/$fabricLoaderVersion/fabric-loader-${fabricLoaderVersion}.jar")

        def output = [
                installer  : [
                        minecraft       : minecraftVersion,
                        forge           : forgeVersion,
                        forgeHash       : forgeHash,
                        neoforge        : neoforgeVersion,
                        neoforgeHash    : neoforgeHash,
                        fabricLoader    : fabricLoaderVersion,
                        fabricLoaderHash: fabricHash,
                ],
                libraries  : artifacts(libs),
                fabricExtra: artifacts(fabricLibs)
        ]
        outputs.files.singleFile.text = JsonOutput.toJson(output)
    }
}
