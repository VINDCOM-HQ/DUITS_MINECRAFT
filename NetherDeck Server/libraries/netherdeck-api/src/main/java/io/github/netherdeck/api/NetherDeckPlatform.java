package io.github.netherdeck.api;

/**
 * Platforms where NetherDeck supports
 */
public enum NetherDeckPlatform {
    VANILLA,
    FORGE,
    NEOFORGE,
    FABRIC;

    private static NetherDeckPlatform platform;

    public static void setPlatform(NetherDeckPlatform platform) {
        if (NetherDeckPlatform.platform != null) throw new IllegalStateException("Platform is already set!");
        if (platform == null) throw new IllegalArgumentException("Platform cannot be null!");
        NetherDeckPlatform.platform = platform;
    }

    public static NetherDeckPlatform current() {
        if (NetherDeckPlatform.platform == null) throw new IllegalStateException("Version is not set!");
        return platform;
    }
}
