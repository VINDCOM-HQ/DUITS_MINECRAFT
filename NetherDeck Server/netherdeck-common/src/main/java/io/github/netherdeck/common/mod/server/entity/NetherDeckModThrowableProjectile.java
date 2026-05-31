package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.projectile.ThrowableItemProjectile;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftThrowableProjectile;

public class NetherDeckModThrowableProjectile extends CraftThrowableProjectile {

    public NetherDeckModThrowableProjectile(CraftServer server, ThrowableItemProjectile entity) {
        super(server, entity);
    }
}
