package io.github.netherdeck.common.mixin.core.world.entity.ai.goal;

import io.github.netherdeck.common.bridge.core.entity.MobEntityBridge;
import net.minecraft.world.entity.ai.goal.target.DefendVillageTargetGoal;
import net.minecraft.world.entity.animal.IronGolem;
import org.bukkit.event.entity.EntityTargetEvent;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(DefendVillageTargetGoal.class)
public class DefendVillageTargetGoalMixin {

    @Shadow @Final private IronGolem golem;

    @Inject(method = "start", at = @At("HEAD"))
    public void netherdeck$reason(CallbackInfo ci) {
        ((MobEntityBridge) this.golem).bridge$pushGoalTargetReason(EntityTargetEvent.TargetReason.DEFEND_VILLAGE, true);
    }
}
