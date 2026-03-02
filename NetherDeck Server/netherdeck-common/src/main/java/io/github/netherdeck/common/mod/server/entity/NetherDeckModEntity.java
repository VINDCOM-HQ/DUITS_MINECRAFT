package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.Entity;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftEntity;

public class NetherDeckModEntity extends CraftEntity {

    public NetherDeckModEntity(CraftServer server, Entity entity) {
        super(server, entity);
    }
}
