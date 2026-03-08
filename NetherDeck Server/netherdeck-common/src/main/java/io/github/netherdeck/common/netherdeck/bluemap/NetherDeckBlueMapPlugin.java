package io.github.netherdeck.common.netherdeck.bluemap;

import de.bluecolored.bluemap.common.plugin.Plugin;
import de.bluecolored.bluemap.common.serverinterface.Server;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Wraps BlueMap's {@link Plugin} class, providing NetherDeck-specific
 * configuration of the config/data directory and binding our {@link Server}
 * adapter to BlueMap's render pipeline.
 *
 * <p>BlueMap's {@code Plugin} handles:
 * <ul>
 *   <li>Reading its own {@code bluemap.conf} / {@code core.conf} config files</li>
 *   <li>Discovering world regions and enqueueing dirty chunks</li>
 *   <li>Running the async 3D PRBM tile renderer</li>
 *   <li>Maintaining low-res PNG overview tiles</li>
 * </ul>
 *
 * <p>NetherDeck sets BlueMap's data root to {@code netherdeck-map/bluemap/} so
 * that tiles are co-located with the rest of the map data and served through
 * the existing {@link NetherDeckMapHttpHandler}.
 */
public final class NetherDeckBlueMapPlugin {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-BlueMap");

    /** Subdirectory under the server root for all BlueMap data and config. */
    static final String BLUEMAP_ROOT = "netherdeck-map/bluemap";

    private final Server serverAdapter;
    private volatile Plugin blueMapPlugin;

    public NetherDeckBlueMapPlugin(Server serverAdapter) {
        this.serverAdapter = serverAdapter;
    }

    /**
     * Initialises BlueMap: reads/creates config, registers worlds and starts
     * the incremental tile render pipeline.
     *
     * @throws IOException if config or data directories cannot be created
     */
    public void load() throws IOException {
        Path root = Path.of(BLUEMAP_ROOT);
        Files.createDirectories(root);

        LOGGER.info("[NetherDeck-BlueMap] Initialising BlueMap core (data root: {})", root.toAbsolutePath());

        // Pre-seed BlueMap config files before Plugin.load() so BlueMap starts correctly
        seedBluemapConfigs(Path.of("netherdeck-map/bluemap/config"));

        // BlueMap 5.x Plugin constructor: (implementationId, serverInterface)
        // The Plugin reads its own bluemap.conf from serverAdapter.getConfigFolder(),
        // and writes rendered tiles to the storage configured in core.conf.
        blueMapPlugin = new Plugin("netherdeck", serverAdapter);

        try {
            blueMapPlugin.load();
            LOGGER.info("[NetherDeck-BlueMap] BlueMap core loaded — render pipeline active");
        } catch (Exception e) {
            LOGGER.error("[NetherDeck-BlueMap] BlueMap load() failed", e);
            throw new IOException("BlueMap plugin failed to load", e);
        }

        // Patch plugin.conf after BlueMap generates it (write-players-interval for live data)
        patchPluginConf(Path.of("netherdeck-map/bluemap/config/plugin.conf"));
    }

    /**
     * Pre-seeds BlueMap config files before Plugin.load() is called.
     * <ul>
     *   <li>{@code core.conf} — sets {@code accept-download: true} (required for BlueMap to render)</li>
     *   <li>{@code webserver.conf} — disables BlueMap's built-in HTTP server (we replace it)</li>
     * </ul>
     */
    private void seedBluemapConfigs(Path configDir) throws IOException {
        Files.createDirectories(configDir);

        // core.conf — must have accept-download: true for BlueMap to load Minecraft resources
        Path coreConf = configDir.resolve("core.conf");
        if (Files.exists(coreConf)) {
            String content = Files.readString(coreConf);
            if (!content.contains("accept-download: true")) {
                String patched = content.replace("accept-download: false", "accept-download: true");
                if (patched.equals(content)) {
                    patched = "accept-download: true\n" + content;
                }
                Files.writeString(coreConf, patched);
                LOGGER.info("[NetherDeck-BlueMap] Patched core.conf: accept-download=true");
            }
        } else {
            Files.writeString(coreConf, "accept-download: true\nrender-thread-count: 2\n");
            LOGGER.info("[NetherDeck-BlueMap] Created core.conf with accept-download=true");
        }

        // webserver.conf — disable BlueMap's built-in webserver; NetherDeckMapHttpHandler replaces it
        Path webserverConf = configDir.resolve("webserver.conf");
        if (Files.exists(webserverConf)) {
            String content = Files.readString(webserverConf);
            if (content.contains("enabled: true")) {
                Files.writeString(webserverConf, content.replace("enabled: true", "enabled: false"));
                LOGGER.info("[NetherDeck-BlueMap] Patched webserver.conf: disabled built-in webserver");
            }
        } else {
            Files.writeString(webserverConf, "enabled: false\n");
        }
    }

    /**
     * Patches {@code plugin.conf} after BlueMap generates it to enable periodic player-position
     * writing so the Three.js web app can show live player markers.
     */
    private void patchPluginConf(Path pluginConf) {
        if (!Files.exists(pluginConf)) {
            return;
        }
        try {
            String content = Files.readString(pluginConf);
            String patched = content
                    .replace("#write-players-interval: 3", "write-players-interval: 3")
                    .replace("write-players-interval: 0", "write-players-interval: 3");
            if (!patched.equals(content)) {
                Files.writeString(pluginConf, patched);
                LOGGER.info("[NetherDeck-BlueMap] Patched plugin.conf: write-players-interval=3");
            }
        } catch (IOException e) {
            LOGGER.warn("[NetherDeck-BlueMap] Could not patch plugin.conf: {}", e.getMessage());
        }
    }

    /**
     * Cleanly shuts down BlueMap's render threads and flushes pending tiles.
     */
    public void unload() {
        var plugin = blueMapPlugin;
        if (plugin != null) {
            try {
                plugin.unload();
                LOGGER.info("[NetherDeck-BlueMap] BlueMap core unloaded");
            } catch (Exception e) {
                LOGGER.warn("[NetherDeck-BlueMap] Error during BlueMap unload", e);
            }
            blueMapPlugin = null;
        }
    }

    public Plugin getBlueMapPlugin() {
        return blueMapPlugin;
    }

    public boolean isLoaded() {
        return blueMapPlugin != null;
    }
}
