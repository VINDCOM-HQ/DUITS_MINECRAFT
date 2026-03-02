package io.github.netherdeck.fabric;

import io.github.netherdeck.api.NetherDeck;
import io.github.netherdeck.fabric.mod.FabricNetherDeckServer;
import io.github.netherdeck.fabric.mod.event.EventHandlerRegistry;
import io.github.netherdeck.fabric.mod.permission.NetherDeckPermissionImpl;
import net.fabricmc.api.ModInitializer;

public class NetherDeckModEntrypoint implements ModInitializer {

    @Override
    public void onInitialize() {
        NetherDeck.setServer(new FabricNetherDeckServer());
        EventHandlerRegistry.register();
        NetherDeckPermissionImpl.init();
    }
}