package io.github.netherdeck.common.bridge.core.entity.player;

import net.minecraft.world.item.ItemStack;

public interface PlayerInventoryBridge {

    int bridge$canHold(ItemStack stack);
}
