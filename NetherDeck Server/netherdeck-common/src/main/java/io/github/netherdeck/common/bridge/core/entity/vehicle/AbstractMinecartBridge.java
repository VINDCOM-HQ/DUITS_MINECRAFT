package io.github.netherdeck.common.bridge.core.entity.vehicle;

public interface AbstractMinecartBridge {

    default boolean bridge$forge$canUseRail() {
        return true;
    }
}
