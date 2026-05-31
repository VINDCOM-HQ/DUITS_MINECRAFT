package io.github.netherdeck.forge.mixin.core.world.level.storage.loot;

import io.github.netherdeck.common.bridge.core.world.storage.loot.LootContextBridge;
import net.minecraft.world.level.storage.loot.LootContext;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(LootContext.class)
public abstract class LootContextMixin_Forge implements LootContextBridge {

}
