package io.github.netherdeck.forge.mixin.bukkit;

import io.github.netherdeck.forge.mod.permission.NetherDeckForgePermissible;
import io.github.netherdeck.i18n.NetherDeckConfig;
import org.bukkit.craftbukkit.v.entity.CraftHumanEntity;
import org.bukkit.permissions.PermissibleBase;
import org.bukkit.permissions.ServerOperator;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(value = CraftHumanEntity.class, remap = false)
public abstract class CraftHumanEntityMixin_Forge {

    @Redirect(method = "<init>", at = @At(value = "NEW", target = "(Lorg/bukkit/permissions/ServerOperator;)Lorg/bukkit/permissions/PermissibleBase;"))
    private PermissibleBase netherdeck$forge$forwardPerm(ServerOperator opable) {
        if (NetherDeckConfig.spec().getCompat().isForwardPermissionReverse()) {
            return new NetherDeckForgePermissible(opable);
        } else {
            return new PermissibleBase(opable);
        }
    }
}
