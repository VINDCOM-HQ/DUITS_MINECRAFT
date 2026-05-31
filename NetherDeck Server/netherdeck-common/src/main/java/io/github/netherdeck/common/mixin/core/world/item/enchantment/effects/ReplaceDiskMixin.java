package io.github.netherdeck.common.mixin.core.world.item.enchantment.effects;

import io.github.netherdeck.common.mod.server.event.NetherDeckEventFactory;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.enchantment.EnchantedItemInUse;
import net.minecraft.world.item.enchantment.effects.ReplaceDisk;
import net.minecraft.world.level.block.state.BlockState;
import org.bukkit.craftbukkit.v.block.CraftBlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(ReplaceDisk.class)
public class ReplaceDiskMixin {

    @Decorate(method = "apply", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;setBlockAndUpdate(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)Z"))
    private boolean netherdeck$changeBlock(ServerLevel instance, BlockPos pos, BlockState newState, ServerLevel level, int i, EnchantedItemInUse enchantedItemInUse, Entity entity) throws Throwable {
        final var event = NetherDeckEventFactory.callBlockFormEvent(instance, pos, newState, 3, entity);
        if (event != null) {
            if (event.isCancelled()) {
                return false;
            }
            newState = ((CraftBlockState) event.getNewState()).getHandle();
        }
        return (boolean) DecorationOps.callsite().invoke(instance, pos, newState);
    }
}
