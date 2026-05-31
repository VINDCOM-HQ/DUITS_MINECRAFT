package io.github.netherdeck.common.mixin.core.world.level.block;

import net.minecraft.world.level.block.SaplingBlock;
import org.spongepowered.asm.mixin.Mixin;

// todo Re-implement this
@Mixin(SaplingBlock.class)
public abstract class SaplingBlockMixin {

    // @formatter:off
    //@Shadow public abstract void grow(IWorld worldIn, BlockPos pos, BlockState state, Random rand);
    // @formatter:on

    // @SuppressWarnings("unchecked")
    /*
    @Redirect(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/block/SaplingBlock;grow(Lnet/minecraft/world/IWorld;Lnet/minecraft/util/math/BlockPos;Lnet/minecraft/block/BlockState;Ljava/util/Random;)V"))
    public void netherdeck$treeGrow(SaplingBlock saplingBlock, IWorld worldIn, BlockPos pos, BlockState state, Random rand) {
        BlockStateListPopulator populator = new NetherDeckBlockPopulator(worldIn.getWorld());
        this.grow(populator, pos, state, rand);
        if (populator.getBlocks().size() > 0) {
            TreeType treeType = NetherDeckCaptures.getTreeType();
            Location location = CraftBlock.at(worldIn, pos).getLocation();
            StructureGrowEvent event = new StructureGrowEvent(location, treeType, false, null, (List<org.bukkit.block.BlockState>) (Object) populator.getList());
            Bukkit.getPluginManager().callEvent(event);
            if (!event.isCancelled()) {
                populator.updateList();
            }
        }
    }*/
}
