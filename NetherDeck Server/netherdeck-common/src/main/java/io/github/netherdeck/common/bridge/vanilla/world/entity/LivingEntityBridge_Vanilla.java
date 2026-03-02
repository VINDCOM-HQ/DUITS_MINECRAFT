package io.github.netherdeck.common.bridge.vanilla.world.entity;

import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.item.ItemEntity;

import java.util.List;

public interface LivingEntityBridge_Vanilla {
    void netherdeck$vanilla$callLivingDropsEvent(DamageSource source, List<ItemEntity> capturedDrops);
}
