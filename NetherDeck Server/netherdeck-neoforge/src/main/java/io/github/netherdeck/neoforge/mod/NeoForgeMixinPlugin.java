package io.github.netherdeck.neoforge.mod;

import io.github.netherdeck.common.mod.NetherDeckCommon;
import io.github.netherdeck.common.mod.NetherDeckMixinPlugin;

public class NeoForgeMixinPlugin extends NetherDeckMixinPlugin {

    @Override
    public void onLoad(String mixinPackage) {
        NetherDeckCommon.setInstance(new NeoForgeCommonImpl());
    }
}
