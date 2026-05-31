package io.github.netherdeck.common.mixin.bukkit;

import com.google.common.collect.ImmutableMap;
import io.github.netherdeck.common.bridge.bukkit.SimpleRegistryBridge;
import org.bukkit.Keyed;
import org.bukkit.NamespacedKey;
import org.bukkit.Registry;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.Map;
import java.util.function.Predicate;

@Mixin(value = Registry.SimpleRegistry.class, remap = false)
public class Registry_SimpleRegistryMixin<T extends Enum<T> & Keyed> implements SimpleRegistryBridge {

    @Shadow @Final @Mutable private Map<NamespacedKey, T> map;

    private Runnable netherdeck$reloadCallback;

    @Inject(method = "<init>(Ljava/lang/Class;Ljava/util/function/Predicate;)V", at = @At("RETURN"))
    private void netherdeck$init(Class<T> type, Predicate<T> predicate, CallbackInfo ci) {
        this.netherdeck$reloadCallback = () -> {
            ImmutableMap.Builder<NamespacedKey, T> builder = ImmutableMap.builder();

            for (T entry : type.getEnumConstants()) {
                if (predicate.test(entry)) {
                    builder.put(entry.getKey(), entry);
                }
            }

            map = builder.build();
        };
    }

    @Override
    public void bridge$reload() {
        this.netherdeck$reloadCallback.run();
    }
}
