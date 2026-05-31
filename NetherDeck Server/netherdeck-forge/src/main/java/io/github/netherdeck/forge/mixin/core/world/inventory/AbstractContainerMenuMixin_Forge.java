package io.github.netherdeck.forge.mixin.core.world.inventory;

import io.github.netherdeck.common.bridge.core.inventory.container.ContainerBridge;
import net.minecraft.world.inventory.AbstractContainerMenu;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(AbstractContainerMenu.class)
public abstract class AbstractContainerMenuMixin_Forge implements ContainerBridge {

}
