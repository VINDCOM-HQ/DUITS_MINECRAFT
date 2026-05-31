package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.DetectorRailBlock;
import net.minecraft.world.level.block.state.BlockState;
import org.bukkit.Bukkit;
import org.bukkit.block.Block;
import org.bukkit.craftbukkit.v.block.CraftBlock;
import org.bukkit.event.block.BlockRedstoneEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

import java.util.List;

@Mixin(DetectorRailBlock.class)
public class DetectorRailBlockMixin {

    @Decorate(method = "checkPressed", at = @At(value = "INVOKE", target = "Ljava/util/List;isEmpty()Z"))
    private boolean netherdeck$blockRedstone(List<?> instance, Level level, BlockPos blockPos, BlockState blockState,
                                           @Local(ordinal = 0) boolean flag) throws Throwable {
        boolean result = (boolean) DecorationOps.callsite().invoke(instance);
        boolean flag1 = !result;
        if (flag != flag1) {
            Block block = CraftBlock.at(level, blockPos);

            BlockRedstoneEvent eventRedstone = new BlockRedstoneEvent(block, flag ? 15 : 0, flag1 ? 15 : 0);
            Bukkit.getPluginManager().callEvent(eventRedstone);

            flag1 = eventRedstone.getNewCurrent() > 0;
        }
        return !flag1;
    }
}
