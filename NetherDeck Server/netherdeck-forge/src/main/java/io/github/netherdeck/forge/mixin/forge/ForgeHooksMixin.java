package io.github.netherdeck.forge.mixin.forge;

import io.github.netherdeck.common.bridge.bukkit.MessengerBridge;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraftforge.common.ForgeHooks;
import net.minecraftforge.event.network.CustomPayloadEvent;
import org.bukkit.Bukkit;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ForgeHooks.class)
public class ForgeHooksMixin {

    @Inject(method = "onPlaceItemIntoWorld", remap = false, at = @At("HEAD"))
    private static void netherdeck$captureHand(UseOnContext context, CallbackInfoReturnable<InteractionResult> cir) {
        NetherDeckCaptures.capturePlaceEventHand(context.getHand());
    }

    @Inject(method = "onPlaceItemIntoWorld", remap = false, at = @At("RETURN"))
    private static void netherdeck$removeHand(UseOnContext context, CallbackInfoReturnable<InteractionResult> cir) {
        NetherDeckCaptures.getPlaceEventHand(InteractionHand.MAIN_HAND);
    }

    @Inject(method = "onCustomPayload(Lnet/minecraftforge/event/network/CustomPayloadEvent;)Z", at = @At("RETURN"))
    private static void netherdeck$recordUnknown(CustomPayloadEvent event, CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValueZ()) {
            var recorder = ((MessengerBridge) Bukkit.getMessenger()).netherdeck$getPacketRecorder();
            recorder.recordUnknown(event.getChannel());
            recorder.update();
        }
    }
}
