package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.common.bridge.core.world.level.block.MultifaceSpreaderSpreadPosBridge;
import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.MultifaceSpreader;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

@Mixin(MultifaceSpreader.SpreadPos.class)
public abstract class MultifaceSpreader_SpreadPosMixin implements MultifaceSpreaderSpreadPosBridge {
    @Unique private BlockPos source;

    @ShadowConstructor
    abstract void netherdeck$constructor$this(BlockPos pos, Direction face);

    @SuppressWarnings("unused")
    @Unique
    @CreateConstructor
    public void netherdeck$constructor$new(BlockPos pos, Direction face, BlockPos source) {
        netherdeck$constructor$this(pos, face);
        netherdeck$setSource(source);
    }

    @Override
    public void netherdeck$setSource(BlockPos source) {
        this.source = source;
    }

    @Unique
    @Override
    public BlockPos source() {
        return source;
    }
}
