package io.github.netherdeck.common.netherdeck;

import io.github.netherdeck.common.bridge.core.network.NetworkManagerBridge;
import net.minecraft.network.Connection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Determines whether vanilla (unmodded) Minecraft clients can connect.
 * <p>
 * Each platform module calls {@link #resolve(List)} at startup with its
 * platform-specific list of required mod channels. In "auto" mode, vanilla
 * clients are allowed only when no required mod channels are present.
 */
public final class VanillaCompatibility {

    private static final Logger LOGGER = LoggerFactory.getLogger("NetherDeck-VanillaCompat");
    private static final Object LOCK = new Object();
    private static volatile boolean vanillaAllowed;
    private static volatile boolean resolved;

    private VanillaCompatibility() {}

    /**
     * Called once at startup after all mods have registered their network channels.
     * Reads the config setting and determines whether vanilla clients should be allowed.
     *
     * @param requiredModChannels list of required (non-optional) mod channel identifiers
     */
    public static void resolve(List<String> requiredModChannels) {
        if (resolved) {
            return;
        }

        synchronized (LOCK) {
            if (resolved) {
                return;
            }

            String setting = NetherDeckConfig.getInstance().getAllowVanillaClients();

            switch (setting) {
                case "never" -> {
                    vanillaAllowed = false;
                    LOGGER.info("Vanilla client access: DISABLED (config: never)");
                }
                case "always" -> {
                    vanillaAllowed = true;
                    if (!requiredModChannels.isEmpty()) {
                        LOGGER.warn("Vanilla client access: ENABLED (config: always)");
                        LOGGER.warn("Warning: {} required mod channel(s) detected — vanilla clients may experience issues:", requiredModChannels.size());
                        requiredModChannels.forEach(ch -> LOGGER.warn("  - {}", ch));
                    } else {
                        LOGGER.info("Vanilla client access: ENABLED (config: always)");
                    }
                }
                case "auto" -> {
                    vanillaAllowed = requiredModChannels.isEmpty();
                    if (vanillaAllowed) {
                        LOGGER.info("Vanilla client access: ENABLED (auto — no required mod channels detected)");
                    } else {
                        LOGGER.info("Vanilla client access: DISABLED (auto — {} required mod channel(s) detected):", requiredModChannels.size());
                        requiredModChannels.forEach(ch -> LOGGER.info("  - {}", ch));
                    }
                }
                default -> {
                    LOGGER.warn("Unrecognized allow-vanilla-clients value '{}', defaulting to 'auto'", setting);
                    vanillaAllowed = requiredModChannels.isEmpty();
                    if (vanillaAllowed) {
                        LOGGER.info("Vanilla client access: ENABLED (auto — no required mod channels detected)");
                    } else {
                        LOGGER.info("Vanilla client access: DISABLED (auto — {} required mod channel(s) detected):", requiredModChannels.size());
                        requiredModChannels.forEach(ch -> LOGGER.info("  - {}", ch));
                    }
                }
            }

            resolved = true;
        }
    }

    public static boolean isVanillaAllowed() {
        return vanillaAllowed;
    }

    /**
     * Returns true if the given connection is a vanilla client that should bypass
     * platform-specific mod channel negotiation.
     */
    public static boolean shouldBypass(Connection connection) {
        return vanillaAllowed && ((NetworkManagerBridge) connection).bridge$isVanillaClient();
    }
}
