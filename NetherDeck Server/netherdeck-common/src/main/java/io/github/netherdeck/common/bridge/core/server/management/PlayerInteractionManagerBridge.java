package io.github.netherdeck.common.bridge.core.server.management;

import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;

public interface PlayerInteractionManagerBridge {

    boolean bridge$isFiredInteract();

    void bridge$setFiredInteract(boolean b);

    boolean bridge$getInteractResult();

    void bridge$setInteractResult(boolean b);

    void bridge$handleBlockDrop(NetherDeckCaptures.BlockBreakEventContext breakEventContext, BlockPos pos);

    BlockPos bridge$getInteractPosition();

    InteractionHand bridge$getInteractHand();

    ItemStack bridge$getInteractItemStack();
}
