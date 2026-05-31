package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.entity.projectile.TridentEntityBridge;
import io.github.netherdeck.common.mod.util.DistValidate;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TridentItem;
import net.minecraft.world.level.Level;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(TridentItem.class)
public class TridentItemMixin {

    @Decorate(method = "releaseUsing", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;hurtAndBreak(ILnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/entity/EquipmentSlot;)V"))
    private void netherdeck$muteDamage(ItemStack instance, int i, LivingEntity livingEntity, EquipmentSlot equipmentSlot, @Local(ordinal = -1) float f) throws Throwable {
        if (f != 0) {
            DecorationOps.callsite().invoke(instance, i, livingEntity, equipmentSlot);
        }
    }

    @Decorate(method = "releaseUsing", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/Level;addFreshEntity(Lnet/minecraft/world/entity/Entity;)Z"))
    public boolean netherdeck$addEntity(Level world, Entity entityIn, ItemStack stack, Level worldIn, LivingEntity entityLiving, int timeLeft) throws Throwable {
        if (!(boolean) DecorationOps.callsite().invoke(world, entityIn)) {
            if (entityLiving instanceof ServerPlayer) {
                ((ServerPlayerEntityBridge) entityLiving).bridge$getBukkitEntity().updateInventory();
            }
            return (boolean) DecorationOps.cancel().invoke();
        }
        stack.hurtAndBreak(1, entityLiving, LivingEntity.getSlotForHand(entityLiving.getUsedItemHand()));
        ((TridentEntityBridge) entityIn).bridge$setThrownStack(stack.copy());
        return true;
    }

    @Redirect(method = "releaseUsing", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/player/Player;push(DDD)V"))
    private void netherdeck$riptide(Player instance, double x, double y, double z, ItemStack stack, Level worldIn, LivingEntity entityLiving, int timeLeft) {
        if (!DistValidate.isValid(worldIn)) return;
        CraftEventFactory.callPlayerRiptideEvent(instance, stack, (float) x, (float) y, (float) z);
        instance.push(x, y, z);
    }
}
