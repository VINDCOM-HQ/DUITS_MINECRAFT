package io.github.netherdeck.neoforge.mod.event;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.common.mod.util.DistValidate;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.v.block.CraftBlock;
import org.bukkit.event.block.BlockBreakEvent;

public class BlockBreakEventDispatcher {

    // todo
    @SubscribeEvent(receiveCanceled = true)
    public void onBreakBlock(BlockEvent.BreakEvent event) {
        if (DistValidate.isValid(event.getLevel())) {
            CraftBlock craftBlock = CraftBlock.at(event.getLevel(), event.getPos());
            BlockBreakEvent breakEvent = new BlockBreakEvent(craftBlock, ((ServerPlayerEntityBridge) event.getPlayer()).bridge$getBukkitEntity());
            NetherDeckCaptures.captureBlockBreakPlayer(breakEvent);
            breakEvent.setCancelled(event.isCanceled());
            //breakEvent.setExpToDrop(event.getExpToDrop());
            Bukkit.getPluginManager().callEvent(breakEvent);
            event.setCanceled(breakEvent.isCancelled());
            //event.setExpToDrop(breakEvent.getExpToDrop());
        }
    }
}
