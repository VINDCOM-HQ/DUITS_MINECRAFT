package io.github.netherdeck.neoforge;

import io.github.netherdeck.api.NetherDeck;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.neoforge.mod.NeoForgeNetherDeckServer;
import io.github.netherdeck.neoforge.mod.event.NetherDeckEventDispatcherRegistry;
import io.github.netherdeck.common.netherdeck.VanillaCompatibility;
import io.github.netherdeck.neoforge.mod.network.NeoForgeChannelScanner;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.server.ServerAboutToStartEvent;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.io.OutputStream;
import java.io.PrintStream;

@Mod("netherdeck")
public class NetherDeckMod {

    public NetherDeckMod() {
        NetherDeckServer.LOGGER.info("mod-load");
        NetherDeck.setServer(new NeoForgeNetherDeckServer());
        System.setOut(new LoggingPrintStream("STDOUT", System.out, Level.INFO));
        System.setErr(new LoggingPrintStream("STDERR", System.err, Level.ERROR));
        NetherDeckEventDispatcherRegistry.registerAllEventDispatchers();
        NeoForge.EVENT_BUS.addListener(ServerAboutToStartEvent.class, event -> VanillaCompatibility.resolve(NeoForgeChannelScanner.scanRequiredModChannels()));
    }

    private static class LoggingPrintStream extends PrintStream {

        private final Logger logger;
        private final Level level;

        public LoggingPrintStream(String name, @NotNull OutputStream out, Level level) {
            super(out);
            this.logger = LogManager.getLogger(name);
            this.level = level;
        }

        @Override
        public void println(@Nullable String x) {
            logger.log(level, x);
        }

        @Override
        public void println(@Nullable Object x) {
            logger.log(level, String.valueOf(x));
        }
    }
}
