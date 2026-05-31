package io.github.netherdeck.common.netherdeck.worldmap;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

/**
 * Filesystem operations for the {@code netherdeck-map/} tile directory.
 * Thread-safe — all methods operate on immutable path references.
 */
public final class MapTileStorage {

    private static final String ROOT_DIR = "netherdeck-map";

    private final Path baseDir;

    public MapTileStorage(Path serverRoot) {
        this.baseDir = serverRoot.resolve(ROOT_DIR);
    }

    public Path getBaseDir() {
        return baseDir;
    }

    public Path getTilesDir(String worldId) {
        return baseDir.resolve("tiles").resolve(worldId);
    }

    public Path getMetadataFile() {
        return baseDir.resolve("metadata.json");
    }

    public Path getMarkersFile() {
        return baseDir.resolve("markers.json");
    }

    public void ensureDirectories(String worldId) throws IOException {
        Files.createDirectories(getTilesDir(worldId));
    }

    public void ensureBaseDir() throws IOException {
        Files.createDirectories(baseDir);
    }

    public long countTiles(String worldId) throws IOException {
        var tilesDir = getTilesDir(worldId);
        if (!Files.exists(tilesDir)) {
            return 0;
        }
        try (Stream<Path> stream = Files.walk(tilesDir)) {
            return stream.filter(Files::isRegularFile).count();
        }
    }

    public long storageSize() throws IOException {
        if (!Files.exists(baseDir)) {
            return 0;
        }
        try (Stream<Path> stream = Files.walk(baseDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .mapToLong(p -> {
                        try {
                            return Files.size(p);
                        } catch (IOException e) {
                            return 0;
                        }
                    })
                    .sum();
        }
    }
}
