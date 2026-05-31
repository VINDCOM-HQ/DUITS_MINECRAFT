package io.github.netherdeck.neoforge.mod.network;

/**
 * Thread-local context to pass vanilla client status from the configuration listener
 * to NeoForge's internal network methods during the same call stack.
 */
public final class VanillaConnectionContext {

    private static final ThreadLocal<Boolean> VANILLA = ThreadLocal.withInitial(() -> Boolean.FALSE);

    private VanillaConnectionContext() {}

    public static void set(boolean vanilla) {
        VANILLA.set(vanilla);
    }

    public static boolean isVanilla() {
        return VANILLA.get();
    }

    public static void clear() {
        VANILLA.remove();
    }
}
