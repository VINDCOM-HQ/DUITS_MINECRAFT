package io.github.netherdeck.common.mixin.core.util;

import io.github.netherdeck.i18n.NetherDeckConfig;
import net.minecraft.util.StringUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(StringUtil.class)
public class StringUtilMixin {

    @Unique
    private static boolean netherdeck$validUsernameCheck(String name) {
        var regex = NetherDeckConfig.spec().getCompat().getValidUsernameRegex();
        return !regex.isBlank() && name.matches(regex);
    }

    @Inject(method = "isValidPlayerName", cancellable = true, at = @At("HEAD"))
    private static void netherdeck$checkUsername(String name, CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$validUsernameCheck(name)) {
            cir.setReturnValue(true);
        }
    }
}
