package io.github.netherdeck.gradle.extension;

import io.github.netherdeck.gradle.api.extension.INetherDeckSpigotExtension;

public class NetherDeckSpigotExtension implements INetherDeckSpigotExtension {
    private String bukkitRef;
    private String craftBukkitRef;
    private String spigotRef;
    private String buildDataRef;

    @Override
    public String getBukkitRef() {
        return bukkitRef;
    }

    @Override
    public void setBukkitRef(String ref) {
        bukkitRef = ref;
    }

    @Override
    public String getCraftBukkitRef() {
        return craftBukkitRef;
    }

    @Override
    public void setCraftBukkitRef(String ref) {
        craftBukkitRef = ref;
    }

    @Override
    public String getSpigotRef() {
        return spigotRef;
    }

    @Override
    public void setSpigotRef(String ref) {
        spigotRef = ref;
    }

    @Override
    public String getBuildDataRef() {
        return buildDataRef;
    }

    @Override
    public void setBuildDataRef(String ref) {
        buildDataRef = ref;
    }
}
