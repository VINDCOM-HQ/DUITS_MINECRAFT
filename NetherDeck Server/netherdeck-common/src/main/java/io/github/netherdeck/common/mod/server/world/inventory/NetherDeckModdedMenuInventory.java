package io.github.netherdeck.common.mod.server.world.inventory;

import com.google.common.base.Preconditions;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.minecraft.world.Container;
import org.bukkit.craftbukkit.v.inventory.CraftInventory;
import org.bukkit.inventory.ItemStack;

public class NetherDeckModdedMenuInventory extends CraftInventory {
    public NetherDeckModdedMenuInventory(Container inventory) {
        super(inventory);
    }

    @Override
    public void setContents(ItemStack[] items) {
        NetherDeckServer.LOGGER.debug("Overriding content for a modded container menu inventory");
        super.setContents(items);
    }

    @Override
    public void clear() {
        NetherDeckServer.LOGGER.debug("Clearing everything for a modded container menu inventory");
        super.clear();
    }
}
