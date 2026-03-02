package io.github.netherdeck.boot.neoforge.application;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.api.EnumHelper;
import io.github.netherdeck.api.Unsafe;
import io.github.netherdeck.boot.AbstractBootstrap;
import io.github.netherdeck.i18n.NetherDeckConfig;
import io.github.netherdeck.i18n.NetherDeckLocale;

import java.util.Arrays;
import java.util.ServiceLoader;
import java.util.function.Consumer;

public class ApplicationBootstrap implements Consumer<String[]>, AbstractBootstrap {

    private static final int MIN_DEPRECATED_VERSION = 60;
    private static final int MIN_DEPRECATED_JAVA_VERSION = 16;

    @Override
    @SuppressWarnings("unchecked")
    public void accept(String[] args) {
        System.setProperty("java.util.logging.manager", "org.apache.logging.log4j.jul.LogManager");
        System.setProperty("log4j.jul.LoggerAdapter", "io.github.netherdeck.boot.log.NetherDeckLoggerAdapter");
        System.setProperty("log4j.configurationFile", "netherdeck-log4j2.xml");
        NetherDeckLocale.info("i18n.using-language", NetherDeckConfig.spec().getLocale().getCurrent(), NetherDeckConfig.spec().getLocale().getFallback());
        try {
            int javaVersion = (int) Float.parseFloat(System.getProperty("java.class.version"));
            if (javaVersion < MIN_DEPRECATED_VERSION) {
                NetherDeckLocale.error("java.deprecated", System.getProperty("java.version"), MIN_DEPRECATED_JAVA_VERSION);
                Thread.sleep(3000);
            }
            Unsafe.ensureClassInitialized(EnumHelper.class);
        } catch (Throwable t) {
            System.err.println("Your Java is not compatible with NetherDeck.");
            t.printStackTrace();
            return;
        }
        try {
            this.setupMod(NetherDeckPlatform.NEOFORGE);
            this.dirtyHacks();
            int targetIndex = Arrays.asList(args).indexOf("--launchTarget");
            if (targetIndex >= 0 && targetIndex < args.length - 1) {
                args[targetIndex + 1] = "netherdeckserver";
            }
            ServiceLoader.load(getClass().getModule().getLayer(), Consumer.class).stream()
                    .filter(it -> !it.type().getName().contains("netherdeck"))
                    .findFirst().orElseThrow().get().accept(args);
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Fail to launch NetherDeck.");
        }
    }
}
