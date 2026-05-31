package io.github.netherdeck.common.bridge.core.entity.projectile;

import io.github.netherdeck.tools.product.Product;
import io.github.netherdeck.tools.product.Product2;
import net.minecraft.world.entity.projectile.FishingHook;
import net.minecraft.world.item.ItemStack;

import java.util.List;

public interface FishingHookBridge {

    default Product2<Boolean, Integer> bridge$forge$onItemFished(List<ItemStack> stacks, int rodDamage, FishingHook hook) {
        return Product.of(false, rodDamage);
    }
}
