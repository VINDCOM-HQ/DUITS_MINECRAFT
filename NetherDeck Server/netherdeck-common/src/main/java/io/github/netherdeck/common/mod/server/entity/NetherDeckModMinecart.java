package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.vehicle.AbstractMinecart;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftMinecart;

public class NetherDeckModMinecart extends CraftMinecart {

    public NetherDeckModMinecart(CraftServer server, AbstractMinecart entity) {
        super(server, entity);
    }
}
