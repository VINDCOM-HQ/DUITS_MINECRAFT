package io.github.netherdeck.common.mixin.core.world.level.block.entity;

import io.github.netherdeck.common.bridge.core.tileentity.EndGatewayBlockEntityBridge;
import net.minecraft.world.level.block.entity.TheEndGatewayBlockEntity;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(TheEndGatewayBlockEntity.class)
public abstract class EndGatewayBlockEntityMixin extends BlockEntityMixin implements EndGatewayBlockEntityBridge {

}
