package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.projectile.Projectile;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftProjectile;

public class NetherDeckModProjectile extends CraftProjectile {

    public NetherDeckModProjectile(CraftServer server, Projectile entity) {
        super(server, entity);
    }
}
