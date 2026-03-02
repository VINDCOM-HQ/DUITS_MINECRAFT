package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.world.IWorldBridge;
import io.github.netherdeck.common.bridge.core.world.item.BucketItemBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BucketItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.BucketPickup;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.bukkit.craftbukkit.v.inventory.CraftItemStack;
import org.bukkit.craftbukkit.v.util.DummyGeneratorAccess;
import org.bukkit.event.player.PlayerBucketFillEvent;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(BucketItem.class)
public abstract class BucketItemMixin implements BucketItemBridge {

    // @formatter:off
    @Shadow public abstract boolean emptyContents(@Nullable Player player, Level worldIn, BlockPos posIn, @javax.annotation.Nullable BlockHitResult rayTrace);
    // @formatter:on

    // Using @Local doesn't work for Forge since they don't have MixinExtras :(
    // Use Decorate to capture
    @Decorate(method = "use", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/block/BucketPickup;pickupBlock(Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/level/LevelAccessor;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)Lnet/minecraft/world/item/ItemStack;"))
    private ItemStack netherdeck$bucketFill(BucketPickup pickup, Player playerIn, LevelAccessor worldIn, BlockPos pos, BlockState state,
                                          @Local(ordinal = 0) InteractionHand handIn, @Local(ordinal = 0) ItemStack stack, @Local(ordinal = 0) BlockHitResult result) throws Throwable {
        if (IWorldBridge.from(worldIn) instanceof IWorldBridge bridge) {
            ItemStack dummyFluid = pickup.pickupBlock(playerIn, DummyGeneratorAccess.INSTANCE, pos, state);
            PlayerBucketFillEvent event = CraftEventFactory.callPlayerBucketFillEvent(bridge.bridge$getMinecraftWorld(), playerIn, pos, pos, result.getDirection(), stack, dummyFluid.getItem(), handIn);
            if (event.isCancelled()) {
                ((ServerPlayer) playerIn).connection.send(new ClientboundBlockUpdatePacket(worldIn, pos));
                ((ServerPlayerEntityBridge) playerIn).bridge$getBukkitEntity().updateInventory();
                return (ItemStack) DecorationOps.cancel().invoke(new InteractionResultHolder<>(InteractionResult.FAIL, stack));
            } else {
                netherdeck$setCaptureItem(event.getItemStack());
            }
        }
        return (ItemStack) DecorationOps.callsite().invoke(pickup, playerIn, worldIn, pos, state);
    }

    @Inject(method = "use", at = @At("RETURN"))
    private void netherdeck$clean(Level worldIn, Player playerIn, InteractionHand handIn, CallbackInfoReturnable<InteractionResultHolder<ItemStack>> cir) {
        netherdeck$setDirection(null);
        netherdeck$setClick(null);
        netherdeck$setHand(null);
        netherdeck$setStack(null);
    }

    @ModifyArg(method = "use", index = 2, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemUtils;createFilledResult(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/item/ItemStack;)Lnet/minecraft/world/item/ItemStack;"))
    private ItemStack netherdeck$useEventItem(ItemStack itemStack) {
        return netherdeck$getCaptureItem() == null ? itemStack : CraftItemStack.asNMSCopy(netherdeck$getCaptureItem());
    }

    public boolean emptyContents(Player entity, Level world, BlockPos pos, @Nullable BlockHitResult result, Direction direction, BlockPos clicked, ItemStack itemstack, InteractionHand hand) {
        netherdeck$setDirection(direction);
        netherdeck$setClick(clicked);
        netherdeck$setHand(hand);
        netherdeck$setStack(itemstack);
        try {
            return this.emptyContents(entity, world, pos, result);
        } finally {
            netherdeck$setDirection(null);
            netherdeck$setClick(null);
            netherdeck$setHand(null);
            netherdeck$setStack(null);
        }
    }

    @Unique
    @Nullable
    private transient Direction netherdeck$direction;

    @Unique
    @Nullable
    private transient BlockPos netherdeck$click;

    @Unique
    @Nullable
    private transient InteractionHand netherdeck$hand;

    @Unique
    @Nullable
    private transient ItemStack netherdeck$stack;

    @Unique
    @Nullable
    private transient org.bukkit.inventory.ItemStack netherdeck$captureItem;

    @Nullable
    @Override
    public Direction netherdeck$getDirection() {
        return this.netherdeck$direction;
    }

    @Override
    public void netherdeck$setDirection(@Nullable Direction value) {
        this.netherdeck$direction = value;
    }

    @Nullable
    @Override
    public BlockPos netherdeck$getClick() {
        return this.netherdeck$click;
    }

    @Override
    public void netherdeck$setClick(@Nullable BlockPos value) {
        this.netherdeck$click = value;
    }

    @Nullable
    @Override
    public InteractionHand netherdeck$getHand() {
        return this.netherdeck$hand;
    }

    @Override
    public void netherdeck$setHand(@Nullable InteractionHand value) {
        this.netherdeck$hand = value;
    }

    @Nullable
    @Override
    public ItemStack netherdeck$getStack() {
        return this.netherdeck$stack;
    }

    @Override
    public void netherdeck$setStack(@Nullable ItemStack value) {
        this.netherdeck$stack = value;
    }

    @Nullable
    @Override
    public org.bukkit.inventory.ItemStack netherdeck$getCaptureItem() {
        return this.netherdeck$captureItem;
    }

    @Override
    public void netherdeck$setCaptureItem(@Nullable org.bukkit.inventory.ItemStack value) {
        this.netherdeck$captureItem = value;
    }
}
