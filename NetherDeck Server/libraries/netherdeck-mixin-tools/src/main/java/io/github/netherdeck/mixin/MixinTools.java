package io.github.netherdeck.mixin;

import io.github.netherdeck.mixin.injector.Decorator;
import io.github.netherdeck.mixin.injector.DecoratorInfo;
import io.github.netherdeck.mixin.injector.EjectorInfo;
import org.objectweb.asm.tree.ClassNode;
import org.spongepowered.asm.mixin.injection.struct.InjectionInfo;

import java.util.Arrays;
import java.util.concurrent.ThreadLocalRandom;

public class MixinTools {

    public static void setup() {
        InjectionInfo.register(EjectorInfo.class);
        InjectionInfo.register(DecoratorInfo.class);
    }

    public static void onPostMixin(ClassNode classNode) {
        Decorator.postMixin(classNode);
    }
}
