package io.github.netherdeck.common.bridge.core.entity.passive;

import java.util.UUID;

public interface FoxEntityBridge extends AnimalEntityBridge {

    void bridge$addTrustedUUID(UUID uuidIn);
}
