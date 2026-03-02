package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.mod.util.DistValidate;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.MinecartItem;
import net.minecraft.world.item.context.UseOnContext;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(MinecartItem.class)
public class MinecartItemMixin {

    @Decorate(method = "useOn", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;addFreshEntity(Lnet/minecraft/world/entity/Entity;)Z"))
    private boolean netherdeck$entityPlace(ServerLevel world, Entity entityIn, UseOnContext context) throws Throwable {
        if (DistValidate.isValid(world) && CraftEventFactory.callEntityPlaceEvent(context, entityIn).isCancelled()) {
            return (boolean) DecorationOps.cancel().invoke(InteractionResult.FAIL);
        } else if (!(boolean) DecorationOps.callsite().invoke(world, entityIn)) {
            return (boolean) DecorationOps.cancel().invoke(InteractionResult.PASS);
        } else {
            return true;
        }
    }
}
