package io.github.netherdeck.common.mixin.core.world.item.crafting;

import io.github.netherdeck.common.bridge.core.world.item.crafting.IngredientBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.Ingredient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;

import javax.annotation.Nullable;

@Mixin(Ingredient.class)
public abstract class IngredientMixin implements IngredientBridge {

    // @formatter:off
    @Shadow public abstract boolean isEmpty();
    @Shadow public abstract ItemStack[] getItems();
    // @formatter:on

    public boolean exact;

    @Decorate(method = "test(Lnet/minecraft/world/item/ItemStack;)Z", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;is(Lnet/minecraft/world/item/Item;)Z"))
    private boolean netherdeck$exactMatch(ItemStack instance, Item arg, @Nullable ItemStack itemstack) throws Throwable {
        if (exact) {
            if (ItemStack.isSameItemSameComponents(itemstack, instance)) {
                return (boolean) DecorationOps.cancel().invoke(true);
            }
            return false;
        }
        return (boolean) DecorationOps.callsite().invoke(instance, arg);
    }

    @Override
    public void bridge$setExact(boolean exact) {
        this.exact = exact;
    }

    @Override
    public boolean bridge$isExact() {
        return this.exact;
    }
}
