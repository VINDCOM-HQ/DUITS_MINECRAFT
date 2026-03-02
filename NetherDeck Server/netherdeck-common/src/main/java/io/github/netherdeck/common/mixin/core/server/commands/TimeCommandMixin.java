package io.github.netherdeck.common.mixin.core.server.commands;

import io.github.netherdeck.common.bridge.core.world.server.ServerWorldBridge;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.commands.TimeCommand;
import net.minecraft.server.level.ServerLevel;
import org.bukkit.Bukkit;
import org.bukkit.event.world.TimeSkipEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

import java.util.List;

@Mixin(TimeCommand.class)
public class TimeCommandMixin {

    @Redirect(method = "setTime", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/MinecraftServer;getAllLevels()Ljava/lang/Iterable;"))
    private static Iterable<ServerLevel> netherdeck$useSourceLevel1(MinecraftServer server, CommandSourceStack source) {
        return List.of(source.getLevel());
    }

    @Redirect(method = "addTime", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/MinecraftServer;getAllLevels()Ljava/lang/Iterable;"))
    private static Iterable<ServerLevel> netherdeck$useSourceLevel2(MinecraftServer server, CommandSourceStack source) {
        return List.of(source.getLevel());
    }

    @Redirect(method = "addTime", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;setDayTime(J)V"))
    private static void netherdeck$addTimeEvent(ServerLevel serverWorld, long time) {
        TimeSkipEvent event = new TimeSkipEvent(((ServerWorldBridge) serverWorld).bridge$getWorld(), TimeSkipEvent.SkipReason.COMMAND, time - serverWorld.getDayTime());
        Bukkit.getPluginManager().callEvent(event);
        if (!event.isCancelled()) {
            serverWorld.setDayTime(serverWorld.getDayTime() + event.getSkipAmount());
        }
    }

    @Redirect(method = "setTime", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerLevel;setDayTime(J)V"))
    private static void netherdeck$setTimeEvent(ServerLevel serverWorld, long time) {
        TimeSkipEvent event = new TimeSkipEvent(((ServerWorldBridge) serverWorld).bridge$getWorld(), TimeSkipEvent.SkipReason.COMMAND, time - serverWorld.getDayTime());
        Bukkit.getPluginManager().callEvent(event);
        if (!event.isCancelled()) {
            serverWorld.setDayTime(serverWorld.getDayTime() + event.getSkipAmount());
        }
    }
}
