package io.github.netherdeck.common.mod.util.remapper;

import org.objectweb.asm.tree.ClassNode;

public interface PluginTransformer {

    void handleClass(ClassNode node, ClassLoaderRemapper remapper, NetherDeckRemapConfig config);

    default int priority() {
        return 0;
    }
}
