package io.github.netherdeck.common.mixin.core.world.entity.monster;

import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.monster.Silverfish;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.InfestedBlock;
import net.minecraft.world.level.block.state.BlockState;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(targets = "net.minecraft.world.entity.monster.Silverfish$SilverfishWakeUpFriendsGoal")
public abstract class Silverfish_WakeUpFriendsGoalMixin extends Goal {

    @Shadow @Final private Silverfish silverfish;

    @Decorate(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/block/state/BlockState;getBlock()Lnet/minecraft/world/level/block/Block;"))
    private Block netherdeck$entityChangeBlock(BlockState instance, @Local(ordinal = -1) BlockPos pos) throws Throwable {
        var block = (Block) DecorationOps.callsite().invoke(instance);
        if (block instanceof InfestedBlock) {
            if (!CraftEventFactory.callEntityChangeBlockEvent(this.silverfish, pos, Blocks.AIR.defaultBlockState())) {
                return Blocks.AIR;
            }
        }
        return block;
    }
}
