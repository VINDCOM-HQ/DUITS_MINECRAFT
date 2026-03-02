package io.github.netherdeck.common.mod.util.remapper.patcher;

import io.github.netherdeck.common.mod.util.log.NetherDeckPluginLogger;
import io.github.netherdeck.common.mod.util.remapper.NetherDeckRemapConfig;
import io.github.netherdeck.common.mod.util.remapper.ClassLoaderRemapper;
import io.github.netherdeck.common.mod.util.remapper.PluginTransformer;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodInsnNode;

public class PluginLoggerTransformer implements PluginTransformer {

    @Override
    public void handleClass(ClassNode node, ClassLoaderRemapper remapper, NetherDeckRemapConfig config) {
        for (var mn : node.methods) {
            for (var insn : mn.instructions) {
                if (insn.getOpcode() == Opcodes.INVOKESTATIC && insn instanceof MethodInsnNode method
                    && method.owner.equals("java/util/logging/Logger") && method.name.equals("getLogger")) {
                    method.owner = Type.getInternalName(NetherDeckPluginLogger.class);
                }
            }
        }
    }
}
