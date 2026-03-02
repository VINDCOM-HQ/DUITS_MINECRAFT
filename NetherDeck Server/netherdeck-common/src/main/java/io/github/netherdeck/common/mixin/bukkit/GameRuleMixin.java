package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import org.bukkit.GameRule;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(value = GameRule.class, remap = false)
public class GameRuleMixin<T> {
    @Decorate(method = "<init>", at = @At(value = "INVOKE", target = "Lcom/google/common/base/Preconditions;checkArgument(ZLjava/lang/String;Ljava/lang/Object;)V"))
    private void netherdeck$allowStringRule(boolean expression, String errorMessageTemplate, Object p1, String name, Class<T> type) throws Throwable {
        DecorationOps.callsite().invoke(expression || type == String.class, "Must be of type Boolean, Integer or String. Found %s", p1);
    }
}
