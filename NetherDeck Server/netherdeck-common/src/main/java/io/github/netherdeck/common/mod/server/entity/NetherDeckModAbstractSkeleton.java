package io.github.netherdeck.common.mod.server.entity;

import net.minecraft.world.entity.monster.AbstractSkeleton;
import org.bukkit.craftbukkit.v.CraftServer;
import org.bukkit.craftbukkit.v.entity.CraftAbstractSkeleton;
import org.bukkit.entity.Skeleton;
import org.jetbrains.annotations.NotNull;

public class NetherDeckModAbstractSkeleton extends CraftAbstractSkeleton {
    public NetherDeckModAbstractSkeleton(CraftServer server, AbstractSkeleton entity) {
        super(server, entity);
    }

    @NotNull
    @Override
    public Skeleton.SkeletonType getSkeletonType() {
        return Skeleton.SkeletonType.NORMAL;
    }

    @Override
    public void setSkeletonType(Skeleton.SkeletonType type) {
    }
}
