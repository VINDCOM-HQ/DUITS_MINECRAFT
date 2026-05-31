package io.github.netherdeck.boot.neoforge.mod;

import net.neoforged.fml.loading.targets.NeoForgeServerLaunchHandler;

public class NetherDeckLaunchHandler extends NeoForgeServerLaunchHandler {

    @Override
    public String name() {
        return "netherdeckserver";
    }

    @Override
    protected String[] preLaunch(String[] arguments, ModuleLayer layer) {
        // skip the log4j configuration reloading
        return arguments;
    }
}
