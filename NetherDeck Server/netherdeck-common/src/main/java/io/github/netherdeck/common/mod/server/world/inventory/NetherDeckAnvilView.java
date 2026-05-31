package io.github.netherdeck.common.mod.server.world.inventory;

import net.minecraft.world.inventory.AnvilMenu;
import org.bukkit.craftbukkit.v.inventory.view.CraftAnvilView;
import org.bukkit.entity.HumanEntity;
import org.bukkit.inventory.AnvilInventory;

public class NetherDeckAnvilView extends CraftAnvilView {
    public NetherDeckAnvilView(HumanEntity player, AnvilInventory viewing, AnvilMenu container) {
        super(player, viewing, container);
    }
}
