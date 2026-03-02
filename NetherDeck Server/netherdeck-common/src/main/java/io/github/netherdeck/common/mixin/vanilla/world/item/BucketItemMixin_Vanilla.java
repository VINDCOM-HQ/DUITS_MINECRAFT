package io.github.netherdeck.common.mixin.vanilla.world.item;

import com.llamalad7.mixinextras.sugar.Local;
import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.world.IWorldBridge;
import io.github.netherdeck.common.bridge.core.world.item.BucketItemBridge;
import net.minecraft.core.BlockPos;
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BucketItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.bukkit.event.player.PlayerBucketEmptyEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(BucketItem.class)
public abstract class BucketItemMixin_Vanilla implements BucketItemBridge {
    @Inject(method = "use", require = 0, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/BucketItem;emptyContents(Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/level/Level;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/phys/BlockHitResult;)Z"))
    private void netherdeck$capture(Level worldIn, Player playerIn, InteractionHand hand, CallbackInfoReturnable<InteractionResultHolder<ItemStack>> cir, @Local BlockHitResult result, @Local ItemStack stack) {
        netherdeck$setDirection(result.getDirection());
        netherdeck$setClick(result.getBlockPos());
        netherdeck$setHand(hand);
        netherdeck$setStack(stack);
    }

    @Inject(method = "emptyContents", require = 0, cancellable = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/dimension/DimensionType;ultraWarm()Z"))
    private void netherdeck$bucketEmpty(Player player, Level worldIn, BlockPos posIn, BlockHitResult rayTrace, CallbackInfoReturnable<Boolean> cir) {
        if (IWorldBridge.from(worldIn) instanceof IWorldBridge bridge && player != null && netherdeck$getStack() != null) {
            PlayerBucketEmptyEvent event = CraftEventFactory.callPlayerBucketEmptyEvent(bridge.bridge$getMinecraftWorld(), player, posIn, netherdeck$getClick(), netherdeck$getDirection(), netherdeck$getStack(), netherdeck$getHand() == null ? InteractionHand.MAIN_HAND : netherdeck$getHand());
            if (event.isCancelled()) {
                ((ServerPlayer) player).connection.send(new ClientboundBlockUpdatePacket(worldIn, posIn));
                ((ServerPlayerEntityBridge) player).bridge$getBukkitEntity().updateInventory();
                cir.setReturnValue(false);
            }
        }
    }
}
