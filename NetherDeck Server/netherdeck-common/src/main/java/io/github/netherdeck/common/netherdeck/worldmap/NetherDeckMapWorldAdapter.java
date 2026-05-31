package io.github.netherdeck.common.netherdeck.worldmap;

import de.bluecolored.bluemap.common.serverinterface.ServerWorld;
import de.bluecolored.bluemap.core.util.Key;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;

import java.nio.file.Path;

/**
 * Adapts a Minecraft {@link ServerLevel} to the BlueMap {@link ServerWorld}
 * interface used internally by the NetherDeck Map rendering pipeline.
 * One instance per enabled dimension.
 */
public final class NetherDeckMapWorldAdapter implements ServerWorld {

    private final ServerLevel level;
    private final Path worldFolder;
    private final Key dimension;

    public NetherDeckMapWorldAdapter(ServerLevel level) {
        this.level = level;
        this.worldFolder = resolveWorldFolder(level);
        this.dimension = resolveDimension(level);
    }

    @Override
    public Path getWorldFolder() {
        return worldFolder;
    }

    @Override
    public Key getDimension() {
        return dimension;
    }

    @Override
    public boolean persistWorldChanges() {
        return false;
    }

    public ServerLevel getLevel() {
        return level;
    }

    public String getId() {
        return level.dimension().location().toString().replace(':', '_');
    }

    private static Path resolveWorldFolder(ServerLevel level) {
        // Return the base world save directory — the rendering engine resolves
        // dimension subfolders (DIM-1, DIM1) via getDimension() internally.
        return level.getServer().getWorldPath(net.minecraft.world.level.storage.LevelResource.ROOT);
    }

    private static Key resolveDimension(ServerLevel level) {
        var key = level.dimension();
        if (key == Level.OVERWORLD) {
            return new Key("minecraft", "overworld");
        } else if (key == Level.NETHER) {
            return new Key("minecraft", "the_nether");
        } else if (key == Level.END) {
            return new Key("minecraft", "the_end");
        }
        var loc = key.location();
        return new Key(loc.getNamespace(), loc.getPath());
    }
}
