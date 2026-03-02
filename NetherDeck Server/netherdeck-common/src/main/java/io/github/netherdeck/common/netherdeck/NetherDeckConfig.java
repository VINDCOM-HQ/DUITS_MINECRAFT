package io.github.netherdeck.common.netherdeck;

import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Configuration for NetherDeck performance optimizations.
 * Loaded from netherdeck.yml in the server root directory.
 * Each toggle gates a specific Mixin module on/off.
 */
public final class NetherDeckConfig {

    private static final Path CONFIG_PATH = Path.of("netherdeck.yml");
    private static volatile NetherDeckConfig instance;

    private final boolean hopperOptimization;
    private final boolean fastutilCollections;
    private final boolean collisionOptimization;
    private final boolean entityActivationImprovements;
    private final boolean mobSpawnOptimization;
    private final boolean chunkTickOptimization;
    private final boolean asyncChunks;
    private final boolean lightingImprovements;
    private final boolean perPlayerMobSpawning;
    private final boolean skipActivationModdedEntities;

    // World Map
    private final boolean worldMapEnabled;
    private final int worldMapHttpPort;
    private final String worldMapHttpBind;
    private final int worldMapRenderThreads;
    private final int worldMapRenderDistance;
    private final int worldMapUpdateInterval;
    private final boolean worldMapOverworld;
    private final boolean worldMapNether;
    private final boolean worldMapTheEnd;

    private NetherDeckConfig(
            boolean hopperOptimization,
            boolean fastutilCollections,
            boolean collisionOptimization,
            boolean entityActivationImprovements,
            boolean mobSpawnOptimization,
            boolean chunkTickOptimization,
            boolean asyncChunks,
            boolean lightingImprovements,
            boolean perPlayerMobSpawning,
            boolean skipActivationModdedEntities,
            boolean worldMapEnabled,
            int worldMapHttpPort,
            String worldMapHttpBind,
            int worldMapRenderThreads,
            int worldMapRenderDistance,
            int worldMapUpdateInterval,
            boolean worldMapOverworld,
            boolean worldMapNether,
            boolean worldMapTheEnd
    ) {
        this.hopperOptimization = hopperOptimization;
        this.fastutilCollections = fastutilCollections;
        this.collisionOptimization = collisionOptimization;
        this.entityActivationImprovements = entityActivationImprovements;
        this.mobSpawnOptimization = mobSpawnOptimization;
        this.chunkTickOptimization = chunkTickOptimization;
        this.asyncChunks = asyncChunks;
        this.lightingImprovements = lightingImprovements;
        this.perPlayerMobSpawning = perPlayerMobSpawning;
        this.skipActivationModdedEntities = skipActivationModdedEntities;
        this.worldMapEnabled = worldMapEnabled;
        this.worldMapHttpPort = worldMapHttpPort;
        this.worldMapHttpBind = worldMapHttpBind;
        this.worldMapRenderThreads = worldMapRenderThreads;
        this.worldMapRenderDistance = worldMapRenderDistance;
        this.worldMapUpdateInterval = worldMapUpdateInterval;
        this.worldMapOverworld = worldMapOverworld;
        this.worldMapNether = worldMapNether;
        this.worldMapTheEnd = worldMapTheEnd;
    }

    public static NetherDeckConfig load() {
        if (instance != null) {
            return instance;
        }
        synchronized (NetherDeckConfig.class) {
            if (instance != null) {
                return instance;
            }
            instance = doLoad();
            return instance;
        }
    }

    public static NetherDeckConfig getInstance() {
        var config = instance;
        if (config == null) {
            return load();
        }
        return config;
    }

    private static NetherDeckConfig doLoad() {
        if (!Files.exists(CONFIG_PATH)) {
            var defaults = createDefaults();
            writeConfig(defaults);
            return defaults;
        }
        try {
            var yaml = new Yaml();
            var content = Files.readString(CONFIG_PATH);
            Map<String, Object> root = yaml.load(content);
            if (root == null) {
                var defaults = createDefaults();
                writeConfig(defaults);
                return defaults;
            }
            @SuppressWarnings("unchecked")
            var perf = (Map<String, Object>) root.getOrDefault("performance", Map.of());
            @SuppressWarnings("unchecked")
            var worldMap = (Map<String, Object>) root.getOrDefault("world-map", Map.of());
            @SuppressWarnings("unchecked")
            var dimensions = (Map<String, Object>) ((worldMap != null ? worldMap : Map.of())).getOrDefault("dimensions", Map.of());
            return new NetherDeckConfig(
                    getBool(perf, "hopper-optimization", true),
                    getBool(perf, "fastutil-collections", true),
                    getBool(perf, "collision-optimization", true),
                    getBool(perf, "entity-activation-improvements", true),
                    getBool(perf, "mob-spawn-optimization", true),
                    getBool(perf, "chunk-tick-optimization", true),
                    getBool(perf, "async-chunks", false),
                    getBool(perf, "lighting-improvements", false),
                    getBool(perf, "per-player-mob-spawning", false),
                    getBool(perf, "skip-activation-modded-entities", true),
                    getBool(worldMap, "enabled", false),
                    getInt(worldMap, "http-port", 8100),
                    getString(worldMap, "http-bind", "127.0.0.1"),
                    getInt(worldMap, "render-threads", 2),
                    getInt(worldMap, "render-distance", 128),
                    getInt(worldMap, "update-interval", 30),
                    getBool(dimensions, "overworld", true),
                    getBool(dimensions, "nether", true),
                    getBool(dimensions, "the-end", true)
            );
        } catch (IOException e) {
            System.err.println("[NetherDeck] Failed to read netherdeck.yml, using defaults: " + e.getMessage());
            return createDefaults();
        }
    }

    private static NetherDeckConfig createDefaults() {
        return new NetherDeckConfig(
                true,   // hopper-optimization
                true,   // fastutil-collections
                true,   // collision-optimization
                true,   // entity-activation-improvements
                true,   // mob-spawn-optimization
                true,   // chunk-tick-optimization
                false,  // async-chunks (disabled - mod compat risk)
                false,  // lighting-improvements (disabled)
                false,  // per-player-mob-spawning (disabled)
                true,   // skip-activation-modded-entities (safety valve)
                false,  // world-map enabled (opt-in)
                8100,   // world-map http-port
                "127.0.0.1", // world-map http-bind
                2,      // world-map render-threads
                128,    // world-map render-distance (chunk radius)
                30,     // world-map update-interval (seconds)
                true,   // world-map dimensions.overworld
                true,   // world-map dimensions.nether
                true    // world-map dimensions.the-end
        );
    }

    private static void writeConfig(NetherDeckConfig config) {
        var dumperOptions = new DumperOptions();
        dumperOptions.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
        dumperOptions.setPrettyFlow(true);
        dumperOptions.setIndent(2);

        var perf = new LinkedHashMap<String, Object>();
        perf.put("hopper-optimization", config.hopperOptimization);
        perf.put("fastutil-collections", config.fastutilCollections);
        perf.put("collision-optimization", config.collisionOptimization);
        perf.put("entity-activation-improvements", config.entityActivationImprovements);
        perf.put("mob-spawn-optimization", config.mobSpawnOptimization);
        perf.put("chunk-tick-optimization", config.chunkTickOptimization);
        perf.put("async-chunks", config.asyncChunks);
        perf.put("lighting-improvements", config.lightingImprovements);
        perf.put("per-player-mob-spawning", config.perPlayerMobSpawning);
        perf.put("skip-activation-modded-entities", config.skipActivationModdedEntities);

        var worldMap = new LinkedHashMap<String, Object>();
        worldMap.put("enabled", config.worldMapEnabled);
        worldMap.put("http-port", config.worldMapHttpPort);
        worldMap.put("http-bind", config.worldMapHttpBind);
        worldMap.put("render-threads", config.worldMapRenderThreads);
        worldMap.put("render-distance", config.worldMapRenderDistance);
        worldMap.put("update-interval", config.worldMapUpdateInterval);
        var dims = new LinkedHashMap<String, Object>();
        dims.put("overworld", config.worldMapOverworld);
        dims.put("nether", config.worldMapNether);
        dims.put("the-end", config.worldMapTheEnd);
        worldMap.put("dimensions", dims);

        var root = new LinkedHashMap<String, Object>();
        root.put("performance", perf);
        root.put("world-map", worldMap);

        var yaml = new Yaml(dumperOptions);
        var header = """
                # NetherDeck Configuration
                # NeoForge+Bukkit hybrid server with Paper performance patches
                #
                # performance: toggles for optimization modules (disable if mod compat issues)
                # world-map: built-in 3D world map (powered by BlueMap Core)
                # Changes require a server restart.

                """;
        try {
            Files.writeString(CONFIG_PATH, header + yaml.dump(root));
        } catch (IOException e) {
            System.err.println("[NetherDeck] Failed to write netherdeck.yml: " + e.getMessage());
        }
    }

    private static boolean getBool(Map<String, Object> map, String key, boolean defaultValue) {
        var value = map.get(key);
        if (value instanceof Boolean b) {
            return b;
        }
        return defaultValue;
    }

    private static int getInt(Map<String, Object> map, String key, int defaultValue) {
        var value = map.get(key);
        if (value instanceof Number n) {
            return n.intValue();
        }
        return defaultValue;
    }

    private static String getString(Map<String, Object> map, String key, String defaultValue) {
        var value = map.get(key);
        if (value instanceof String s) {
            return s;
        }
        return defaultValue;
    }

    // Getters (immutable)

    public boolean isHopperOptimization() {
        return hopperOptimization;
    }

    public boolean isFastutilCollections() {
        return fastutilCollections;
    }

    public boolean isCollisionOptimization() {
        return collisionOptimization;
    }

    public boolean isEntityActivationImprovements() {
        return entityActivationImprovements;
    }

    public boolean isMobSpawnOptimization() {
        return mobSpawnOptimization;
    }

    public boolean isChunkTickOptimization() {
        return chunkTickOptimization;
    }

    public boolean isAsyncChunks() {
        return asyncChunks;
    }

    public boolean isLightingImprovements() {
        return lightingImprovements;
    }

    public boolean isPerPlayerMobSpawning() {
        return perPlayerMobSpawning;
    }

    public boolean isSkipActivationModdedEntities() {
        return skipActivationModdedEntities;
    }

    // World Map getters

    public boolean isWorldMapEnabled() {
        return worldMapEnabled;
    }

    public int getWorldMapHttpPort() {
        return worldMapHttpPort;
    }

    public String getWorldMapHttpBind() {
        return worldMapHttpBind;
    }

    public int getWorldMapRenderThreads() {
        return worldMapRenderThreads;
    }

    public int getWorldMapRenderDistance() {
        return worldMapRenderDistance;
    }

    public int getWorldMapUpdateInterval() {
        return worldMapUpdateInterval;
    }

    public boolean isWorldMapOverworld() {
        return worldMapOverworld;
    }

    public boolean isWorldMapNether() {
        return worldMapNether;
    }

    public boolean isWorldMapTheEnd() {
        return worldMapTheEnd;
    }
}
