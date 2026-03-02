package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.projectile.windcharge.AbstractWindCharge;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftAbstractWindCharge;

public class NetherDeckModWindCharge extends CraftAbstractWindCharge {

    public NetherDeckModWindCharge(CraftServer server, AbstractWindCharge entity) {
        super(server, entity);
    }
}
