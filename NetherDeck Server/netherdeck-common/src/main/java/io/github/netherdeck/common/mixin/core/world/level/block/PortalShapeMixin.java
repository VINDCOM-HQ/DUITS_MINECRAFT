package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.common.bridge.core.world.IWorldBridge;
import io.github.netherdeck.common.bridge.core.world.level.block.PortalSizeBridge;
import io.github.netherdeck.common.mod.mixins.annotation.RenameInto;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.NetherPortalBlock;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.portal.PortalShape;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.craftbukkit.v.util.BlockStateListPopulator;
import org.bukkit.event.world.PortalCreateEvent;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import javax.annotation.Nullable;

@Mixin(PortalShape.class)
public abstract class PortalShapeMixin implements PortalSizeBridge {

    // @formatter:off
    @Shadow @Final private LevelAccessor level;
    @Shadow public abstract void createPortalBlocks();
    @Shadow @Final private Direction.Axis axis;
    @Shadow @Nullable private BlockPos bottomLeft;
    @Shadow private int height;
    @Shadow @Final private Direction rightDir;
    @Shadow @Final private int width;
    // @formatter:on

    BlockStateListPopulator blocks;

    @Decorate(method = "<init>", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/portal/PortalShape;calculateBottomLeft(Lnet/minecraft/core/BlockPos;)Lnet/minecraft/core/BlockPos;"))
    private void netherdeck$init(LevelAccessor levelAccessor) {
        this.blocks = new BlockStateListPopulator(levelAccessor);
    }

    @Decorate(method = "getDistanceUntilEdgeAboveFrame", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/block/state/BlockBehaviour$StatePredicate;test(Lnet/minecraft/world/level/block/state/BlockState;Lnet/minecraft/world/level/BlockGetter;Lnet/minecraft/core/BlockPos;)Z"))
    private boolean netherdeck$captureBlock(BlockBehaviour.StatePredicate predicate, net.minecraft.world.level.block.state.BlockState p_test_1_, BlockGetter p_test_2_, BlockPos pos) throws Throwable {
        boolean test = (boolean) DecorationOps.callsite().invoke(predicate, p_test_1_, p_test_2_, pos);
        if (test) {
            blocks.setBlock(pos, this.level.getBlockState(pos), 18);
        }
        return test;
    }

    @Decorate(method = "hasTopFrame", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/block/state/BlockBehaviour$StatePredicate;test(Lnet/minecraft/world/level/block/state/BlockState;Lnet/minecraft/world/level/BlockGetter;Lnet/minecraft/core/BlockPos;)Z"))
    private boolean netherdeck$captureBlock2(BlockBehaviour.StatePredicate predicate, net.minecraft.world.level.block.state.BlockState p_test_1_, BlockGetter p_test_2_, BlockPos pos) throws Throwable {
        boolean test = (boolean) DecorationOps.callsite().invoke(predicate, p_test_1_, p_test_2_, pos);
        if (test) {
            blocks.setBlock(pos, this.level.getBlockState(pos), 18);
        }
        return test;
    }

    @Decorate(method = "getDistanceUntilTop", at = @At(value = "INVOKE", ordinal = 1, target = "Lnet/minecraft/world/level/block/state/BlockBehaviour$StatePredicate;test(Lnet/minecraft/world/level/block/state/BlockState;Lnet/minecraft/world/level/BlockGetter;Lnet/minecraft/core/BlockPos;)Z"))
    private boolean netherdeck$captureBlock3(BlockBehaviour.StatePredicate predicate, net.minecraft.world.level.block.state.BlockState p_test_1_, BlockGetter p_test_2_, BlockPos pos,
                                           @Local(ordinal = 0) int i) throws Throwable {
        boolean test = (boolean) DecorationOps.callsite().invoke(predicate, p_test_1_, p_test_2_, pos);
        if (test) {
            var mutablePos = pos.mutable();
            blocks.setBlock(mutablePos.set(this.bottomLeft).move(Direction.UP, i).move(this.rightDir, -1), this.level.getBlockState(mutablePos), 18);
            blocks.setBlock(mutablePos.set(this.bottomLeft).move(Direction.UP, i).move(this.rightDir, this.width), this.level.getBlockState(mutablePos), 18);
        }
        return test;
    }

    @Inject(method = "createPortalBlocks", cancellable = true, at = @At("HEAD"))
    private void netherdeck$buildPortal(CallbackInfo ci) {
        if (IWorldBridge.from(this.level) instanceof IWorldBridge bridge) {
            World world = bridge.bridge$getMinecraftWorld().bridge$getWorld();
            net.minecraft.world.level.block.state.BlockState blockState = Blocks.NETHER_PORTAL.defaultBlockState().setValue(NetherPortalBlock.AXIS, this.axis);
            BlockPos.betweenClosed(this.bottomLeft, this.bottomLeft.relative(Direction.UP, this.height - 1).relative(this.rightDir, this.width - 1)).forEach((blockPos) -> {
                blocks.setBlock(blockPos, blockState, 18);
            });
            PortalCreateEvent event = new PortalCreateEvent((java.util.List<org.bukkit.block.BlockState>) (java.util.List) this.blocks.getList(), world, null, PortalCreateEvent.CreateReason.FIRE);
            Bukkit.getPluginManager().callEvent(event);
            netherdeck$ret = !event.isCancelled();
            if (event.isCancelled()) {
                ci.cancel();
            }
        }
    }

    private transient boolean netherdeck$ret;

    @RenameInto("createPortalBlocks")
    public boolean bukkit$createPortalBlocks() {
        this.createPortalBlocks();
        return netherdeck$ret;
    }

    @Override
    public boolean bridge$createPortal() {
        return bukkit$createPortalBlocks();
    }
}
