package io.github.netherdeck.common.mixin.optimization.general;

import io.github.netherdeck.i18n.NetherDeckConfig;
import net.minecraft.world.entity.ai.goal.Goal;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

@Mixin(Goal.class)
public class GoalMixin {

    @ModifyConstant(method = "reducedTickDelay", constant = @Constant(intValue = 2))
    private static int netherdeck$goalUpdateInterval(int orig) {
        return NetherDeckConfig.spec().getOptimization().getGoalSelectorInterval();
    }
}
