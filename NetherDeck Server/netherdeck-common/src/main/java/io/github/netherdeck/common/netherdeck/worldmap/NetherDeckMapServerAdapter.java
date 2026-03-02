package io.github.netherdeck.common.netherdeck.worldmap;

import de.bluecolored.bluemap.common.serverinterface.Player;
import de.bluecolored.bluemap.common.serverinterface.Server;
import de.bluecolored.bluemap.common.serverinterface.ServerEventListener;
import de.bluecolored.bluemap.common.serverinterface.ServerWorld;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import org.jetbrains.annotations.Nullable;

import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Adapts the Minecraft {@link MinecraftServer} to the BlueMap {@link Server}
 * interface used internally by the NetherDeck Map rendering pipeline.
 * Provides world discovery and player enumeration.
 */
public final class NetherDeckMapServerAdapter implements Server {

    private final MinecraftServer server;
    private final MapConfig config;
    private final List<ServerEventListener> listeners = new CopyOnWriteArrayList<>();
    private final Map<ServerLevel, NetherDeckMapWorldAdapter> worldAdapters = new LinkedHashMap<>();

    public NetherDeckMapServerAdapter(MinecraftServer server, MapConfig config) {
        this.server = server;
        this.config = config;
        initWorldAdapters();
    }

    private void initWorldAdapters() {
        for (ServerLevel level : server.getAllLevels()) {
            if (shouldRenderDimension(level)) {
                worldAdapters.put(level, new NetherDeckMapWorldAdapter(level));
            }
        }
    }

    private boolean shouldRenderDimension(ServerLevel level) {
        var key = level.dimension();
        if (key == Level.OVERWORLD) return config.overworld();
        if (key == Level.NETHER) return config.nether();
        if (key == Level.END) return config.theEnd();
        return false;
    }

    @Override
    @Nullable
    public String getMinecraftVersion() {
        return server.getServerVersion();
    }

    @Override
    public Path getConfigFolder() {
        return Path.of("netherdeck-map").resolve("config");
    }

    @Override
    public Optional<Path> getModsFolder() {
        var modsDir = Path.of("mods");
        if (modsDir.toFile().isDirectory()) {
            return Optional.of(modsDir);
        }
        return Optional.empty();
    }

    @Override
    public Collection<ServerWorld> getLoadedServerWorlds() {
        return Collections.unmodifiableCollection(worldAdapters.values());
    }

    @Override
    public Collection<Player> getOnlinePlayers() {
        return Collections.emptyList();
    }

    @Override
    public void registerListener(ServerEventListener listener) {
        listeners.add(listener);
    }

    @Override
    public void unregisterAllListeners() {
        listeners.clear();
    }

    public Map<ServerLevel, NetherDeckMapWorldAdapter> getWorldAdapters() {
        return Collections.unmodifiableMap(worldAdapters);
    }

    public MinecraftServer getMinecraftServer() {
        return server;
    }
}
