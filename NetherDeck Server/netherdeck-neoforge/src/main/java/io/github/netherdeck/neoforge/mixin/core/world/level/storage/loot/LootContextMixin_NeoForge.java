package io.github.netherdeck.neoforge.mixin.core.world.level.storage.loot;

import io.github.netherdeck.common.bridge.core.world.storage.loot.LootContextBridge;
import net.minecraft.world.level.storage.loot.LootContext;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(LootContext.class)
public abstract class LootContextMixin_NeoForge implements LootContextBridge {

}
