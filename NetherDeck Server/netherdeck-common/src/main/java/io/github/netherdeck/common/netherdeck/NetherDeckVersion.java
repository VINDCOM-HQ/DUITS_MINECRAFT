package io.github.netherdeck.common.netherdeck;

/**
 * Version information for NetherDeck.
 */
public final class NetherDeckVersion {

    public static final String NAME = "NetherDeck";
    public static final String VERSION = "1.0.0-SNAPSHOT";
    public static final String MC_VERSION = "1.21.1";
    public static final String NEOFORGE_VERSION = "21.1.216";
    public static final String BASE = "NetherDeck (FeudalKings)";
    public static final String LICENSE = "GPL-3.0";

    private NetherDeckVersion() {
    }

    public static String getFullVersion() {
        return NAME + " " + VERSION + " (MC " + MC_VERSION + ")";
    }
}
