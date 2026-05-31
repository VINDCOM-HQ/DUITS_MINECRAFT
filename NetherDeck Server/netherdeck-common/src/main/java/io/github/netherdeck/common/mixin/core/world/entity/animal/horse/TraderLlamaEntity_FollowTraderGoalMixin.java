package io.github.netherdeck.common.mixin.core.world.entity.animal.horse;

import io.github.netherdeck.common.bridge.core.entity.MobEntityBridge;
import io.github.netherdeck.common.mixin.core.world.entity.ai.goal.TargetGoalMixin;
import org.bukkit.event.entity.EntityTargetEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@SuppressWarnings("public-target")
@Mixin(targets = "net.minecraft.world.entity.animal.horse.TraderLlama$TraderLlamaDefendWanderingTraderGoal")
public class TraderLlamaEntity_FollowTraderGoalMixin extends TargetGoalMixin {

    @Inject(method = "start", at = @At("HEAD"))
    private void netherdeck$reason(CallbackInfo ci) {
        ((MobEntityBridge) this.mob).bridge$pushGoalTargetReason(EntityTargetEvent.TargetReason.TARGET_ATTACKED_OWNER, true);
    }
}
