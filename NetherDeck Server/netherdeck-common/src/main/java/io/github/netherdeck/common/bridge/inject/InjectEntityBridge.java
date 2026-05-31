package io.github.netherdeck.common.bridge.inject;

import io.github.netherdeck.common.bridge.core.entity.EntityBridge;
import org.bukkit.craftbukkit.v.entity.CraftEntity;

public interface InjectEntityBridge {

    default CraftEntity bridge$getBukkitEntity() {
        throw new IllegalStateException("Not implemented");
    }

    default EntityBridge bridge() {
        return (EntityBridge) this;
    }
}
