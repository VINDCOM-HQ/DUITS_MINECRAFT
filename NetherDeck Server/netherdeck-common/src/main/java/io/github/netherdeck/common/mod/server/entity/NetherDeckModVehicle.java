package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.vehicle.VehicleEntity;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftVehicle;

public class NetherDeckModVehicle extends CraftVehicle {

    public NetherDeckModVehicle(CraftServer server, VehicleEntity entity) {
        super(server, entity);
    }
}
