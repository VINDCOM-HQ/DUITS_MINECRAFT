package io.github.netherdeck.fabric.mixin.core.world.entity;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import io.github.netherdeck.common.bridge.vanilla.world.entity.LivingEntityBridge_Vanilla;
import io.github.netherdeck.fabric.mod.event.LivingDropsEvent;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.item.ItemEntity;
import org.spongepowered.asm.mixin.Mixin;

import java.util.List;

@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin_Fabric extends EntityMixin_Fabric implements LivingEntityBridge, LivingEntityBridge_Vanilla {

    @Override
    public void netherdeck$vanilla$callLivingDropsEvent(DamageSource source, List<ItemEntity> capturedDrops) {
        boolean cancelled = LivingDropsEvent.EVENT.invoker().onLivingDrops((LivingEntity) (Object)this, source, capturedDrops, false);
        if (cancelled) {
            capturedDrops.clear();
        }
    }
}
