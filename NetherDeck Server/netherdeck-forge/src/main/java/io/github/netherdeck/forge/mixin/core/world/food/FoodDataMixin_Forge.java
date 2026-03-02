package io.github.netherdeck.forge.mixin.core.world.food;

import io.github.netherdeck.common.bridge.core.util.FoodStatsBridge;
import net.minecraft.world.food.FoodData;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;

@Mixin(FoodData.class)
public abstract class FoodDataMixin_Forge implements FoodStatsBridge {

    // @formatter:off
    @Shadow public int foodLevel;
    @Shadow public abstract void eat(int i, float f);
    // @formatter:on
}
