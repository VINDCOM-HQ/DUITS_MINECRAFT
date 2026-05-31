package io.github.netherdeck.common.mixin.optimization.general;

import io.github.netherdeck.i18n.NetherDeckConfig;
import net.minecraft.world.entity.Mob;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

@Mixin(Mob.class)
public class MobMixin_Optimization {

    @ModifyConstant(method = "serverAiStep", constant = @Constant(intValue = 2))
    private int netherdeck$goalUpdateInterval(int orig) {
        return NetherDeckConfig.spec().getOptimization().getGoalSelectorInterval();
    }
}
