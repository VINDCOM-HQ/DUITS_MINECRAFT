package io.github.netherdeck.gradle.extension;

import io.github.netherdeck.gradle.api.extension.INetherDeckExtension;
import io.github.netherdeck.gradle.api.extension.INetherDeckMappingsExtension;
import org.gradle.api.Action;
import org.gradle.api.Project;

import java.io.File;
import java.nio.file.Path;

public class NetherDeckExtension implements INetherDeckExtension {
    private Path cacheDir;
    private String mcVersion;
    private String bukkitVersion;
    private String spigotReversion;
    private File accessTransformer;
    private File extraMapping;
    private final INetherDeckMappingsExtension mappingsConfiguration = new NetherDeckMappingsExtension();

    public NetherDeckExtension(Project project) {
        this.cacheDir = project.getRootProject().getRootDir().toPath().resolve(".gradle/netherdeck");
    }

    @Override
    public Path getCacheDir() {
        return cacheDir;
    }

    @Override
    public void setCacheDir(Path path) {
        cacheDir = path;
    }

    @Override
    public String getMcVersion() {
        return mcVersion;
    }

    @Override
    public void setMcVersion(String mcVersion) {
        this.mcVersion = mcVersion;
    }

    @Override
    public String getBukkitVersion() {
        return bukkitVersion;
    }

    @Override
    public void setBukkitVersion(String bukkitVersion) {
        this.bukkitVersion = bukkitVersion;
    }

    @Override
    public String getSpigotReversion() {
        return spigotReversion;
    }

    @Override
    public void setSpigotReversion(String rev) {
        spigotReversion = rev;
    }

    @Override
    public File getAccessTransformer() {
        return accessTransformer;
    }

    @Override
    public void setAccessTransformer(File accessTransformer) {
        this.accessTransformer = accessTransformer;
    }

    @Override
    public File getExtraMapping() {
        return extraMapping;
    }

    @Override
    public void setExtraMapping(File extraMapping) {
        this.extraMapping = extraMapping;
    }

    @Override
    public INetherDeckMappingsExtension getMappingsConfiguration() {
        return mappingsConfiguration;
    }

    @Override
    public void mappings(Action<INetherDeckMappingsExtension> spec) {
        spec.execute(mappingsConfiguration);
    }
}
