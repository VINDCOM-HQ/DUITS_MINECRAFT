package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.raid.Raider;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftRaider;

public class NetherDeckModRaider extends CraftRaider {

    public NetherDeckModRaider(CraftServer server, Raider entity) {
        super(server, entity);
    }
}
