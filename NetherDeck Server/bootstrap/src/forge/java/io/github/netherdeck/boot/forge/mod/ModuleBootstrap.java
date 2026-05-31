package io.github.netherdeck.boot.forge.mod;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.api.EnumHelper;
import io.github.netherdeck.api.Unsafe;
import io.github.netherdeck.boot.AbstractBootstrap;
import io.github.netherdeck.i18n.NetherDeckConfig;
import io.github.netherdeck.i18n.NetherDeckLocale;
import net.minecraftforge.bootstrap.api.BootstrapEntryPoint;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.*;

import java.util.Arrays;
import java.util.ServiceLoader;

public class ModuleBootstrap implements BootstrapEntryPoint, AbstractBootstrap {

    private static final int MIN_DEPRECATED_VERSION = 60;
    private static final int MIN_DEPRECATED_JAVA_VERSION = 16;

    @Override
    public void main(String[] args) {
        System.setProperty("java.util.logging.manager", "org.apache.logging.log4j.jul.LogManager");
        System.setProperty("log4j.jul.LoggerAdapter", "io.github.netherdeck.boot.log.NetherDeckLoggerAdapter");
        System.setProperty("log4j.configurationFile", "netherdeck-log4j2.xml");
        NetherDeckLocale.info("i18n.using-language", NetherDeckConfig.spec().getLocale().getCurrent(), NetherDeckConfig.spec().getLocale().getFallback());
        try {
            int javaVersion = (int) Float.parseFloat(System.getProperty("java.class.version"));
            if (javaVersion < MIN_DEPRECATED_VERSION) {
                NetherDeckLocale.error("java.deprecated", System.getProperty("java.version"), MIN_DEPRECATED_JAVA_VERSION);
                Thread.sleep(3000);
            }
            Unsafe.ensureClassInitialized(EnumHelper.class);
        } catch (Throwable t) {
            System.err.println("Your Java is not compatible with NetherDeck.");
            t.printStackTrace();
            return;
        }
        try {
            this.setupMod(NetherDeckPlatform.FORGE);
            this.dirtyHacks();
            int targetIndex = Arrays.asList(args).indexOf("--launchTarget");
            if (targetIndex >= 0 && targetIndex < args.length - 1) {
                args[targetIndex + 1] = "netherdeck_server";
            }
            ServiceLoader.load(getClass().getModule().getLayer(), BootstrapEntryPoint.class).stream()
                .filter(it -> !it.type().getName().contains("netherdeck"))
                .findFirst().orElseThrow().get().main(args);
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Fail to launch NetherDeck.");
        }
    }

    @Override
    public void dirtyHacks() throws Exception {
        AbstractBootstrap.super.dirtyHacks();
        try (var in = getClass().getClassLoader().getResourceAsStream("net/minecraftforge/fml/loading/moddiscovery/ModDiscoverer.class")) {
            var clazz = new ClassNode();
            new ClassReader(in).accept(clazz, 0);
            final var mdName = "net/minecraftforge/fml/loading/moddiscovery/ModDiscoverer";
            final var mdSig = "L" + mdName + ";";
            {
                MethodNode constructor = null;
                for (var method: clazz.methods) {
                    if ("<init>".equals(method.name)) {
                        constructor = method;
                    }
                }
                if (constructor == null) {
                    throw new RuntimeException("Cannot transform ModDiscoverer: <init> not found");
                }

                FrameNode lastFrame = null;
                for (var insn: constructor.instructions) {
                    if (insn instanceof FrameNode frame) {
                        lastFrame = frame;
                    }
                }
                if (lastFrame == null) {
                    throw new RuntimeException("Cannot transform ModDiscoverer: <init> return not found");
                }

                var aloadThis = new VarInsnNode(Opcodes.ALOAD, 0);
                var putField = new FieldInsnNode(Opcodes.PUTSTATIC, mdName, "netherdeck$INSTANCE", mdSig);
                constructor.instructions.insertBefore(lastFrame, aloadThis);
                constructor.instructions.insert(aloadThis, putField);
                constructor.instructions.insert(putField, new InsnNode(Opcodes.RETURN));
                constructor.instructions.remove(lastFrame);
            }
            {
                clazz.visitField(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, "netherdeck$INSTANCE", mdSig, mdSig, null);
            }
            var cw = new ClassWriter(ClassWriter.COMPUTE_MAXS | ClassWriter.COMPUTE_FRAMES);
            clazz.accept(cw);
            byte[] bytes = cw.toByteArray();
            Unsafe.defineClass(mdName.replace('/', '.'), bytes, 0, bytes.length, getClass().getClassLoader() /* MC-BOOTSTRAP */, getClass().getProtectionDomain());
            System.out.println("Redefined ModDiscoverer in cl:" +getClass().getClassLoader());
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }
}
