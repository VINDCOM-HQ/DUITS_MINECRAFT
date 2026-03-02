package io.github.netherdeck.common.netherdeck.worldmap;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Manages asynchronous tile rendering on dedicated low-priority threads.
 * Never touches the server tick thread — all rendering is background work.
 */
public final class MapRenderScheduler {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-Map");

    private final MapConfig config;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile ScheduledExecutorService executor;

    public MapRenderScheduler(MapConfig config) {
        this.config = config;
    }

    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }

        executor = Executors.newScheduledThreadPool(config.renderThreads(), r -> {
            var thread = new Thread(r, "NetherDeck-MapRenderer");
            thread.setDaemon(true);
            thread.setPriority(Thread.MIN_PRIORITY);
            return thread;
        });

        executor.scheduleWithFixedDelay(
                this::runRenderCycle,
                5,
                config.updateInterval(),
                TimeUnit.SECONDS
        );

        LOGGER.info("[NetherDeck-Map] Render scheduler started with {} threads, {}s interval",
                config.renderThreads(), config.updateInterval());
    }

    public void stop() {
        if (!running.compareAndSet(true, false)) {
            return;
        }

        var exec = executor;
        if (exec != null) {
            exec.shutdown();
            try {
                if (!exec.awaitTermination(10, TimeUnit.SECONDS)) {
                    exec.shutdownNow();
                }
            } catch (InterruptedException e) {
                exec.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        LOGGER.info("[NetherDeck-Map] Render scheduler stopped");
    }

    public boolean isRunning() {
        return running.get();
    }

    private void runRenderCycle() {
        try {
            // Phase 1: placeholder — actual render integration in Phase 2+
            LOGGER.debug("[NetherDeck-Map] Render cycle tick (no-op in Phase 1)");
        } catch (Exception e) {
            LOGGER.error("[NetherDeck-Map] Render cycle failed", e);
        }
    }
}
