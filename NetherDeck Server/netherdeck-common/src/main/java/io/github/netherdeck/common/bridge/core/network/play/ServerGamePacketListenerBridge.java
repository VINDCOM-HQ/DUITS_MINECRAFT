package io.github.netherdeck.common.bridge.core.network.play;

import io.github.netherdeck.common.bridge.core.network.common.ServerCommonPacketListenerBridge;
import io.github.netherdeck.tools.product.Product;
import io.github.netherdeck.tools.product.Product3;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;
import org.bukkit.Location;
import org.bukkit.event.player.PlayerTeleportEvent;

public interface ServerGamePacketListenerBridge extends ServerCommonPacketListenerBridge {

    void bridge$pushTeleportCause(PlayerTeleportEvent.TeleportCause cause);

    void bridge$teleport(Location dest);

    void bridge$pushNoTeleportEvent();

    boolean bridge$teleportCancelled();

    default Product3<Boolean /* Cancelled */, ItemStack /* SwappedToMainHand */, ItemStack /* SwappedToOffHand */>
    bridge$platform$canSwapHandItems(LivingEntity entity) {
        return Product.of(false, entity.getOffhandItem(), entity.getMainHandItem());
    }

    default InteractionResult bridge$platform$onInteractEntityAt(ServerPlayer player, Entity entity, Vec3 vec,
                                                                 InteractionHand interactionHand) {
        return null;
    }

    void netherdeck$platform$setLastPosX(double d);
    void netherdeck$platform$setLastPosY(double d);
    void netherdeck$platform$setLastPosZ(double d);
    void netherdeck$platform$setLastPitch(float f);
    void netherdeck$platform$setLastYaw(float f);
}
