package io.github.netherdeck.common.mixin.core.network.protocol.game;

import com.mojang.brigadier.arguments.ArgumentType;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.common.mod.util.VelocitySupport;
import io.netty.buffer.Unpooled;
import net.minecraft.commands.synchronization.ArgumentTypeInfo;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.FriendlyByteBuf;
import org.spigotmc.SpigotConfig;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "net.minecraft.network.protocol.game.ClientboundCommandsPacket$ArgumentNodeStub")
public class ClientboundCommandsPacket_ArgumentNodeStubMixin {

    private static final int NETHERDECK_WRAP_INDEX = -256;

    @Inject(method = "serializeCap(Lnet/minecraft/network/FriendlyByteBuf;Lnet/minecraft/commands/synchronization/ArgumentTypeInfo;Lnet/minecraft/commands/synchronization/ArgumentTypeInfo$Template;)V",
        cancellable = true, at = @At("HEAD"))
    private static <A extends ArgumentType<?>, T extends ArgumentTypeInfo.Template<A>> void netherdeck$wrapArgument(FriendlyByteBuf buf, ArgumentTypeInfo<A, T> type, ArgumentTypeInfo.Template<A> node, CallbackInfo ci) {
        if (!(SpigotConfig.bungee || VelocitySupport.isEnabled())) {
            return;
        }
        var key = BuiltInRegistries.COMMAND_ARGUMENT_TYPE.getKey(type);
        if ((key != null) && (key.getNamespace().equals("minecraft") || key.getNamespace().equals("brigadier"))) {
            return;
        }
        ci.cancel();
        buf.writeVarInt(NETHERDECK_WRAP_INDEX);
        var id = BuiltInRegistries.COMMAND_ARGUMENT_TYPE.getId(type);
        if (id == -1) {
            NetherDeckServer.LOGGER.debug("Command argument type {} is not registered", type);
        }
        buf.writeVarInt(id);
        var payload = new FriendlyByteBuf(Unpooled.buffer());
        type.serializeToNetwork((T) node, payload);
        buf.writeVarInt(payload.readableBytes());
        buf.writeBytes(payload);
    }
}
