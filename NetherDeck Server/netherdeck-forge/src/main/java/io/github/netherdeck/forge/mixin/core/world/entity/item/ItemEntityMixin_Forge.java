package io.github.netherdeck.forge.mixin.core.world.entity.item;

import io.github.netherdeck.common.bridge.core.entity.item.ItemEntityBridge;
import net.minecraft.world.entity.item.ItemEntity;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(ItemEntity.class)
public class ItemEntityMixin_Forge implements ItemEntityBridge {
}
