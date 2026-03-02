package io.github.netherdeck.common.mixin.core.world.entity.raid;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.world.WorldBridge;
import io.github.netherdeck.common.bridge.core.world.raid.RaidBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.advancements.critereon.PlayerTrigger;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.raid.Raid;
import net.minecraft.world.entity.raid.Raider;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.bukkit.entity.Player;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.raid.RaidStopEvent;
import org.objectweb.asm.Opcodes;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.Slice;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Mixin(Raid.class)
public class RaidMixin implements RaidBridge {

    // @formatter:off
    @Shadow @Final private Map<Integer, Set<Raider>> groupRaiderMap;
    @Shadow @Final private ServerLevel level;
    // @formatter:on

    @Inject(method = "tick", at = @At(value = "INVOKE", ordinal = 0, target = "Lnet/minecraft/world/entity/raid/Raid;stop()V"),
        slice = @Slice(from = @At(value = "FIELD", target = "Lnet/minecraft/world/Difficulty;PEACEFUL:Lnet/minecraft/world/Difficulty;")))
    public void netherdeck$stopPeace(CallbackInfo ci) {
        CraftEventFactory.callRaidStopEvent((Raid) (Object) this, RaidStopEvent.Reason.PEACE);
    }

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;stop()V"),
        slice = @Slice(
            from = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;isVillage(Lnet/minecraft/core/BlockPos;)Z"),
            to = @At(value = "FIELD", opcode = Opcodes.PUTFIELD, target = "Lnet/minecraft/world/entity/raid/Raid;ticksActive:J")
        ))
    public void netherdeck$stopNotInVillage(CallbackInfo ci) {
        CraftEventFactory.callRaidStopEvent((Raid) (Object) this, RaidStopEvent.Reason.NOT_IN_VILLAGE);
    }

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;stop()V"),
        slice = @Slice(
            from = @At(value = "FIELD", opcode = Opcodes.PUTFIELD, target = "Lnet/minecraft/world/entity/raid/Raid;ticksActive:J"),
            to = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;getTotalRaidersAlive()I")
        ))
    public void netherdeck$stopTimeout(CallbackInfo ci) {
        CraftEventFactory.callRaidStopEvent((Raid) (Object) this, RaidStopEvent.Reason.TIMEOUT);
    }

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;stop()V"),
        slice = @Slice(
            from = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;shouldSpawnGroup()Z"),
            to = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;isStarted()Z")
        ))
    public void netherdeck$stopUnspawnable(CallbackInfo ci) {
        CraftEventFactory.callRaidStopEvent((Raid) (Object) this, RaidStopEvent.Reason.UNSPAWNABLE);
    }

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;stop()V"),
        slice = @Slice(from = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;isOver()Z")))
    public void netherdeck$stopFinish(CallbackInfo ci) {
        CraftEventFactory.callRaidStopEvent((Raid) (Object) this, RaidStopEvent.Reason.FINISHED);
    }

    @Inject(method = "tick", at = @At(value = "FIELD", shift = At.Shift.BY, by = 2, target = "Lnet/minecraft/world/entity/raid/Raid$RaidStatus;LOSS:Lnet/minecraft/world/entity/raid/Raid$RaidStatus;"))
    public void netherdeck$finishNone(CallbackInfo ci) {
        CraftEventFactory.callRaidFinishEvent((Raid) (Object) this, new ArrayList<>());
    }

    private transient List<Player> netherdeck$winners;

    @Redirect(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/advancements/critereon/PlayerTrigger;trigger(Lnet/minecraft/server/level/ServerPlayer;)V"))
    public void netherdeck$addWinner(PlayerTrigger trigger, ServerPlayer player) {
        trigger.trigger(player);
        if (netherdeck$winners == null) {
            netherdeck$winners = new ArrayList<>();
        }
        netherdeck$winners.add(((ServerPlayerEntityBridge) player).bridge$getBukkitEntity());
    }

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;setDirty()V"))
    public void netherdeck$finish(CallbackInfo ci) {
        List<Player> winners = this.netherdeck$winners == null ? new ArrayList<>() : this.netherdeck$winners;
        this.netherdeck$winners = null;
        CraftEventFactory.callRaidFinishEvent((Raid) (Object) this, winners);
    }

    private transient Raider netherdeck$leader;
    private transient List<Raider> netherdeck$raiders;

    @Decorate(method = "spawnGroup", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;setLeader(ILnet/minecraft/world/entity/raid/Raider;)V"))
    public void netherdeck$captureLeader(Raid raid, int raidId, Raider entity) throws Throwable {
        DecorationOps.callsite().invoke(raid, raidId, entity);
        netherdeck$leader = entity;
    }

    @Decorate(method = "spawnGroup", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/raid/Raid;joinRaid(ILnet/minecraft/world/entity/raid/Raider;Lnet/minecraft/core/BlockPos;Z)V"))
    public void netherdeck$captureRaider(Raid raid, int wave, Raider entity, BlockPos pos, boolean flag) throws Throwable {
        DecorationOps.callsite().invoke(raid, wave, entity, pos, flag);
        if (netherdeck$raiders == null) {
            netherdeck$raiders = new ArrayList<>();
        }
        netherdeck$raiders.add(entity);
    }

    @Inject(method = "spawnGroup", at = @At("RETURN"))
    public void netherdeck$spawnWave(BlockPos pos, CallbackInfo ci) {
        CraftEventFactory.callRaidSpawnWaveEvent((Raid) (Object) this, netherdeck$leader, netherdeck$raiders);
    }

    @Inject(method = "joinRaid(ILnet/minecraft/world/entity/raid/Raider;Lnet/minecraft/core/BlockPos;Z)V", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;addFreshEntityWithPassengers(Lnet/minecraft/world/entity/Entity;)V"))
    public void netherdeck$addEntity(int wave, Raider p_221317_2_, BlockPos p_221317_3_, boolean p_221317_4_, CallbackInfo ci) {
        ((WorldBridge) this.level).bridge$pushAddEntityReason(CreatureSpawnEvent.SpawnReason.RAID);
    }

    public Collection<Raider> getRaiders() {
        HashSet<Raider> set = new HashSet<>();
        for (Set<Raider> entities : this.groupRaiderMap.values()) {
            set.addAll(entities);
        }
        return set;
    }

    @Override
    public Collection<Raider> bridge$getRaiders() {
        return getRaiders();
    }
}
