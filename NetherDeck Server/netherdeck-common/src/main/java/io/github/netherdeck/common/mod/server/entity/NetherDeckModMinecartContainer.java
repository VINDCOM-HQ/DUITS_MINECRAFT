package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.vehicle.AbstractMinecartContainer;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftMinecartContainer;

public class NetherDeckModMinecartContainer extends CraftMinecartContainer {

    public NetherDeckModMinecartContainer(CraftServer server, AbstractMinecartContainer entity) {
        super(server, entity);
    }
}
