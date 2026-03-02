package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.bridge.core.world.item.MerchantOfferBridge;
import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.trading.ItemCost;
import net.minecraft.world.item.trading.MerchantOffer;
import org.bukkit.craftbukkit.v.inventory.CraftMerchantRecipe;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;

import java.util.Optional;

@Mixin(MerchantOffer.class)
public abstract class MerchantOfferMixin implements MerchantOfferBridge {

    // @formatter:off
    @Shadow public ItemCost baseCostA;
    @Shadow private int demand;
    // @formatter:on

    private CraftMerchantRecipe bukkitHandle;

    public CraftMerchantRecipe asBukkit() {
        return (bukkitHandle == null) ? bukkitHandle = new CraftMerchantRecipe((MerchantOffer) (Object) this) : bukkitHandle;
    }

    @ShadowConstructor
    public void netherdeck$constructor(ItemCost itemCost, Optional<ItemCost> optional, ItemStack itemStack, int i, int j, int k, float f, int l) {
        throw new RuntimeException();
    }

    @CreateConstructor
    public void netherdeck$constructor(ItemCost itemCost, Optional<ItemCost> optional, ItemStack itemStack, int i, int j, int k, float f, int l, CraftMerchantRecipe bukkit) {
        netherdeck$constructor(itemCost, optional, itemStack, i, j, k, f, l);
        this.bukkitHandle = bukkit;
    }

    @Override
    public CraftMerchantRecipe bridge$asBukkit() {
        return asBukkit();
    }
}
