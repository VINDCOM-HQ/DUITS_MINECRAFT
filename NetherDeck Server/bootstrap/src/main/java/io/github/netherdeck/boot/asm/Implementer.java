package io.github.netherdeck.boot.asm;

import io.github.netherdeck.boot.log.NetherDeckI18nLogger;
import org.apache.logging.log4j.Logger;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.lang.reflect.Modifier;

public interface Implementer {

    Logger LOGGER = NetherDeckI18nLogger.getLogger("Implementer");

    boolean processClass(ClassNode node);

    static void loadArgs(InsnList list, MethodNode methodNode, Type[] types, int i) {
        if (!Modifier.isStatic(methodNode.access)) {
            list.add(new VarInsnNode(Opcodes.ALOAD, i));
            i += 1;
        }
        for (Type type : types) {
            list.add(new VarInsnNode(type.getOpcode(Opcodes.ILOAD), i));
            i += type.getSize();
        }
    }
}
