package io.github.netherdeck.common.bridge.core.server;

import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.TimeSource;
import net.minecraft.world.level.ForcedChunksSavedData;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.command.RemoteConsoleCommandSender;
import org.bukkit.craftbukkit.v.CraftServer;

public interface MinecraftServerBridge {

    void bridge$setConsole(ConsoleCommandSender console);

    void bridge$setServer(CraftServer server);

    CraftServer bridge$getServer();

    RemoteConsoleCommandSender bridge$getRemoteConsole();

    void bridge$queuedProcess(Runnable runnable);

    void bridge$drainQueuedTasks();

    boolean bridge$hasStopped();

    Commands bridge$getVanillaCommands();

    void netherdeck$onServerLoad(ServerLevel level);

    void netherdeck$onServerUnload(ServerLevel level);

    default void bridge$forge$markLevelsDirty() {}

    default void bridge$forge$reinstatePersistentChunks(ServerLevel level, ForcedChunksSavedData savedData) {}

    default void bridge$forge$lockRegistries() {}

    default void bridge$forge$unlockRegistries() {}

    void netherdeck$extendNextTickTimeTo(TimeSource.NanoTimeSource timeSource);
}
