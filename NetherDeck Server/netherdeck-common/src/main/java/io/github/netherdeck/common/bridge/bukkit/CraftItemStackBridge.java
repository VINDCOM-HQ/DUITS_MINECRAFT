package io.github.netherdeck.common.bridge.bukkit;

import net.minecraft.world.entity.item.ItemEntity;

public interface CraftItemStackBridge {
    void netherdeck$setItemEntity(ItemEntity entity);
    ItemEntity netherdeck$getItemEntity();
}
