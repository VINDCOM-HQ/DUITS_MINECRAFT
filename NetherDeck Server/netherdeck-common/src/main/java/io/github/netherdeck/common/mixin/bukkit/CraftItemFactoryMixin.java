package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.common.bridge.bukkit.MaterialBridge;
import io.github.netherdeck.i18n.conf.MaterialPropertySpec;
import org.bukkit.Material;
import org.bukkit.craftbukkit.v.inventory.CraftItemFactory;
import org.bukkit.craftbukkit.v.inventory.CraftMetaItem;
import org.bukkit.craftbukkit.v.util.CraftLegacy;
import org.bukkit.inventory.meta.ItemMeta;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = CraftItemFactory.class, remap = false)
public class CraftItemFactoryMixin {

    @SuppressWarnings("AmbiguousMixinReference")
    @Inject(method = "getItemMeta*", require = 0, expect = 0, cancellable = true, at = @At("HEAD"))
    private void netherdeck$getItemMeta(Material material, CraftMetaItem meta, CallbackInfoReturnable<ItemMeta> cir) {
        MaterialBridge bridge = (MaterialBridge) (Object) CraftLegacy.fromLegacy(material);
        if (bridge.bridge$getType() != MaterialPropertySpec.MaterialType.VANILLA) {
            cir.setReturnValue(bridge.bridge$itemMetaFactory().apply(meta));
        }
    }
}
