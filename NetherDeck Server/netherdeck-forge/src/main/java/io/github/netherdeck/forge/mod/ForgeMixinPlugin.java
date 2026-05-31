package io.github.netherdeck.forge.mod;

import io.github.netherdeck.common.mod.NetherDeckCommon;
import io.github.netherdeck.common.mod.NetherDeckMixinPlugin;

public class ForgeMixinPlugin extends NetherDeckMixinPlugin {

    @Override
    public void onLoad(String mixinPackage) {
        NetherDeckCommon.setInstance(new ForgeCommonImpl());
    }
}
