package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.common.bridge.core.world.IWorldBridge;
import io.github.netherdeck.common.mod.server.event.NetherDeckEventFactory;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.LiquidBlock;
import net.minecraft.world.level.block.state.BlockState;
import org.bukkit.craftbukkit.v.block.CraftBlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LiquidBlock.class)
public class LiquidBlockMixin {

    private transient boolean netherdeck$fizz = true;

    @Decorate(method = "shouldSpreadLiquid", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/Level;setBlockAndUpdate(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)Z"))
    public boolean netherdeck$blockForm(Level world, BlockPos pos, BlockState newState) throws Throwable {
        if (IWorldBridge.from(world) instanceof IWorldBridge bridge) {
            final var event = NetherDeckEventFactory.callBlockFormEvent(bridge.bridge$getMinecraftWorld(), pos, newState, 3, null);
            if (event != null) {
                if (event.isCancelled()) {
                    return false;
                }
                newState = ((CraftBlockState) event.getNewState()).getHandle();
            }
        }
        return netherdeck$fizz = (boolean) DecorationOps.callsite().invoke(world, pos, newState);
    }

    @Inject(method = "fizz", cancellable = true, at = @At("HEAD"))
    public void netherdeck$fizz(LevelAccessor worldIn, BlockPos pos, CallbackInfo ci) {
        if (!netherdeck$fizz) {
            ci.cancel();
        }
    }
}
