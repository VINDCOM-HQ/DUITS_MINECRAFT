package io.github.netherdeck.fabric.mixin.bukkit;

import io.github.netherdeck.fabric.mod.permission.NetherDeckFabricPermissible;
import io.github.netherdeck.i18n.NetherDeckConfig;
import org.bukkit.craftbukkit.v.entity.CraftHumanEntity;
import org.bukkit.permissions.PermissibleBase;
import org.bukkit.permissions.ServerOperator;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(value = CraftHumanEntity.class, remap = false)
public abstract class CraftHumanEntityMixin_Fabric {

    @Redirect(method = "<init>", at = @At(value = "NEW", target = "(Lorg/bukkit/permissions/ServerOperator;)Lorg/bukkit/permissions/PermissibleBase;"))
    private PermissibleBase netherdeck$forge$forwardPerm(ServerOperator opable) {
        if (NetherDeckConfig.spec().getCompat().isForwardPermissionReverse()) {
            return new NetherDeckFabricPermissible(opable);
        } else {
            return new PermissibleBase(opable);
        }
    }
}
