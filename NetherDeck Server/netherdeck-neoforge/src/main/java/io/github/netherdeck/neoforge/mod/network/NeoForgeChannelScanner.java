package io.github.netherdeck.neoforge.mod.network;

import io.github.netherdeck.neoforge.mixin.neoforge.NetworkRegistryAccessor;
import io.github.netherdeck.neoforge.mod.plugin.messaging.NetherDeckNfMessaging;
import net.minecraft.network.ConnectionProtocol;
import net.minecraft.resources.ResourceLocation;
import net.neoforged.neoforge.network.registration.PayloadRegistration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scans NeoForge's network registry for required mod channels.
 * Used by VanillaCompatibility to determine if vanilla clients can connect.
 */
public final class NeoForgeChannelScanner {

    private NeoForgeChannelScanner() {}

    /**
     * Scans all registered NeoForge payload channels across CONFIGURATION and PLAY protocols.
     * Returns a list of required (non-optional) mod channels that are NOT NeoForge built-ins
     * and NOT NetherDeck Bukkit channels.
     */
    public static List<String> scanRequiredModChannels() {
        List<String> requiredChannels = new ArrayList<>();
        Map<ConnectionProtocol, Map<ResourceLocation, PayloadRegistration<?>>> registrations =
                NetworkRegistryAccessor.getRegistration();

        for (var protocolEntry : registrations.entrySet()) {
            for (var channelEntry : protocolEntry.getValue().entrySet()) {
                ResourceLocation id = channelEntry.getKey();
                PayloadRegistration<?> reg = channelEntry.getValue();

                // Skip NeoForge built-in payloads
                if (NetworkRegistryAccessor.getBuiltinPayload().containsKey(id)) {
                    continue;
                }

                // Skip NetherDeck Bukkit channels (identity check on sentinel version)
                if (reg.version() == NetherDeckNfMessaging.NETHERDECK_CUSTOM_CHANNEL_VERSION) {
                    continue;
                }

                // Skip optional channels — these don't block vanilla clients
                if (reg.optional()) {
                    continue;
                }

                requiredChannels.add(protocolEntry.getKey().id() + "/" + id);
            }
        }

        return requiredChannels;
    }
}
