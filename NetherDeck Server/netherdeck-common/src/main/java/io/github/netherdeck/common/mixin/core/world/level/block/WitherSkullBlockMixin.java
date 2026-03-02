package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.common.bridge.core.world.WorldBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.CarvedPumpkinBlock;
import net.minecraft.world.level.block.WitherSkullBlock;
import net.minecraft.world.level.block.state.pattern.BlockPattern;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(WitherSkullBlock.class)
public class WitherSkullBlockMixin {

    @Redirect(method = "checkSpawn(Lnet/minecraft/world/level/Level;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/entity/SkullBlockEntity;)V", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/block/CarvedPumpkinBlock;clearPatternBlocks(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/level/block/state/pattern/BlockPattern$BlockPatternMatch;)V"))
    private static void netherdeck$clearLater(Level p_249604_, BlockPattern.BlockPatternMatch p_251190_) {
    }

    @Decorate(method = "checkSpawn(Lnet/minecraft/world/level/Level;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/entity/SkullBlockEntity;)V", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/Level;addFreshEntity(Lnet/minecraft/world/entity/Entity;)Z"))
    private static boolean netherdeck$muteSpawn(Level instance, Entity entity, @Local(ordinal = -1) BlockPattern.BlockPatternMatch patternMatch) throws Throwable {
        ((WorldBridge) instance).bridge$pushAddEntityReason(CreatureSpawnEvent.SpawnReason.BUILD_WITHER);
        if (!(boolean) DecorationOps.callsite().invoke(instance, entity)) {
            return (boolean) DecorationOps.cancel().invoke();
        } else {
            CarvedPumpkinBlock.clearPatternBlocks(instance, patternMatch);
        }
        return true;
    }
}
