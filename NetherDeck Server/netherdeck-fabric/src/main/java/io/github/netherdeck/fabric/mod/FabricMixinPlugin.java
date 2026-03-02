package io.github.netherdeck.fabric.mod;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.boot.AbstractBootstrap;
import io.github.netherdeck.common.mod.NetherDeckCommon;
import io.github.netherdeck.common.mod.NetherDeckMixinPlugin;
import io.github.netherdeck.i18n.NetherDeckConfig;
import io.github.netherdeck.i18n.NetherDeckLocale;
import io.github.netherdeck.mixin.MixinTools;
import org.apache.logging.log4j.LogManager;
import org.slf4j.LoggerFactory;

public class FabricMixinPlugin extends NetherDeckMixinPlugin implements AbstractBootstrap {

    @Override
    public void onLoad(String mixinPackage) {
        NetherDeckCommon.setInstance(new FabricCommonImpl());
        super.onLoad(mixinPackage);
        MixinTools.setup();
        LoggerFactory.getLogger("NetherDeck").info(
            NetherDeckLocale.getInstance().format("i18n.using-language", NetherDeckConfig.spec().getLocale().getCurrent(), NetherDeckConfig.spec().getLocale().getFallback())
        );
        try {
            this.setupMod(NetherDeckPlatform.FABRIC, false);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        Runtime.getRuntime().addShutdownHook(new Thread(LogManager::shutdown, "log flusher"));
    }
}
