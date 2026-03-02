package io.github.netherdeck.gradle.api.extension;

import org.gradle.api.Action;

import java.io.File;
import java.nio.file.Path;

public interface INetherDeckExtension {
    Path getCacheDir();
    void setCacheDir(Path path);

    String getMcVersion();
    void setMcVersion(String mcVersion);

    String getBukkitVersion();
    void setBukkitVersion(String bukkitVersion);

    String getSpigotReversion();
    void setSpigotReversion(String spigotReversion);

    File getAccessTransformer();
    void setAccessTransformer(File accessTransformer);

    File getExtraMapping();
    void setExtraMapping(File extraMapping);

    INetherDeckMappingsExtension getMappingsConfiguration();

    void mappings(Action<INetherDeckMappingsExtension> spec);
}
