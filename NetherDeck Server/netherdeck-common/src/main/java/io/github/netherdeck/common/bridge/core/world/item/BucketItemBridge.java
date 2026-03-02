package io.github.netherdeck.common.bridge.core.world.item;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.jetbrains.annotations.Nullable;

public interface BucketItemBridge {
    @Nullable Direction netherdeck$getDirection();
    void netherdeck$setDirection(@Nullable Direction value);

    @Nullable BlockPos netherdeck$getClick();
    void netherdeck$setClick(@Nullable BlockPos value);

    @Nullable InteractionHand netherdeck$getHand();
    void netherdeck$setHand(@Nullable InteractionHand value);

    @Nullable ItemStack netherdeck$getStack();
    void netherdeck$setStack(@Nullable ItemStack value);

    @Nullable org.bukkit.inventory.ItemStack netherdeck$getCaptureItem();
    void netherdeck$setCaptureItem(@Nullable org.bukkit.inventory.ItemStack value);
}
