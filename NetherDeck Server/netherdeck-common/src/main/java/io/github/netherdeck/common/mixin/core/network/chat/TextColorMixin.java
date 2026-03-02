package io.github.netherdeck.common.mixin.core.network.chat;

import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.TextColor;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import javax.annotation.Nullable;

@Mixin(TextColor.class)
public class TextColorMixin {

    // @formatter:off
    @Shadow @Final @Mutable @Nullable public String name;
    // @formatter:on

    public ChatFormatting format;

    @ShadowConstructor
    public void netherdeck$constructor(int color) {
        throw new RuntimeException();
    }

    @CreateConstructor
    public void netherdeck$constructor(int color, String name, ChatFormatting textFormatting) {
        netherdeck$constructor(color);
        this.name = name;
        this.format = textFormatting;
    }

    @Inject(method = "<init>(ILjava/lang/String;)V", at = @At("RETURN"))
    private void netherdeck$withFormat(int color, String name, CallbackInfo ci) {
        this.format = ChatFormatting.getByName(name);
    }
}
