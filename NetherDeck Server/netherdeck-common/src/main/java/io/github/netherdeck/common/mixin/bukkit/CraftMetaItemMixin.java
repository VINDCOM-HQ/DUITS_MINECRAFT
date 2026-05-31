package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.common.bridge.bukkit.ItemMetaBridge;
import org.bukkit.craftbukkit.v.inventory.CraftMetaItem;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;

@Mixin(value = CraftMetaItem.class, remap = false)
public class CraftMetaItemMixin implements ItemMetaBridge {

    // @formatter:off
    @Shadow(remap = false) protected net.minecraft.core.component.DataComponentPatch.Builder unhandledTags;
    // @formatter:on
}
