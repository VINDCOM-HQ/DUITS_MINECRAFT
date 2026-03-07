package io.github.netherdeck.fabric;

import io.github.netherdeck.api.NetherDeck;
import io.github.netherdeck.common.netherdeck.VanillaCompatibility;
import io.github.netherdeck.fabric.mod.FabricNetherDeckServer;
import io.github.netherdeck.fabric.mod.event.EventHandlerRegistry;
import io.github.netherdeck.fabric.mod.permission.NetherDeckPermissionImpl;
import net.fabricmc.api.ModInitializer;

import java.util.List;

public class NetherDeckModEntrypoint implements ModInitializer {

    @Override
    public void onInitialize() {
        NetherDeck.setServer(new FabricNetherDeckServer());
        EventHandlerRegistry.register();
        NetherDeckPermissionImpl.init();
        // Fabric doesn't reject vanilla clients — no required mod channels to scan
        VanillaCompatibility.resolve(List.of());
    }
}