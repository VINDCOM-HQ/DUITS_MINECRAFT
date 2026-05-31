package io.github.netherdeck.common.mixin.core.world.inventory;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.inventory.container.LecternContainerBridge;
import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ContainerData;
import net.minecraft.world.inventory.LecternMenu;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.v.inventory.CraftInventoryLectern;
import org.bukkit.craftbukkit.v.inventory.view.CraftLecternView;
import org.bukkit.event.player.PlayerTakeLecternBookEvent;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(LecternMenu.class)
public abstract class LecternContainerMixin extends AbstractContainerMenuMixin implements LecternContainerBridge {

    // @formatter:off
    @Shadow @Final private Container lectern;
    // @formatter:on

    private CraftLecternView bukkitEntity;
    private Inventory playerInventory;

    @ShadowConstructor
    public void netherdeck$constructor(int i) {
        throw new RuntimeException();
    }

    @ShadowConstructor
    public void netherdeck$constructor(int i, Container inventory, ContainerData intArray) {
        throw new RuntimeException();
    }

    @CreateConstructor
    public void netherdeck$constructor(int i, Inventory playerInventory) {
        netherdeck$constructor(i);
        this.playerInventory = playerInventory;
    }

    @CreateConstructor
    public void netherdeck$constructor(int i, Container inventory, ContainerData intArray, Inventory playerInventory) {
        netherdeck$constructor(i, inventory, intArray);
        this.playerInventory = playerInventory;
    }

    @Inject(method = "clickMenuButton", cancellable = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/Container;removeItemNoUpdate(I)Lnet/minecraft/world/item/ItemStack;"))
    public void netherdeck$takeBook(Player playerIn, int id, CallbackInfoReturnable<Boolean> cir) {
        PlayerTakeLecternBookEvent event = new PlayerTakeLecternBookEvent(((ServerPlayerEntityBridge) this.playerInventory.player).bridge$getBukkitEntity(), ((CraftInventoryLectern) getBukkitView().getTopInventory()).getHolder());
        Bukkit.getServer().getPluginManager().callEvent(event);
        if (event.isCancelled()) {
            cir.setReturnValue(false);
        }
    }

    @Inject(method = "stillValid", cancellable = true, at = @At("HEAD"))
    public void netherdeck$unreachable(Player playerIn, CallbackInfoReturnable<Boolean> cir) {
        if (!bridge$isCheckReachable()) cir.setReturnValue(true);
    }

    @Override
    public CraftLecternView getBukkitView() {
        if (bukkitEntity != null) {
            return bukkitEntity;
        }
        CraftInventoryLectern inventory = new CraftInventoryLectern(this.lectern);
        bukkitEntity = new CraftLecternView(((ServerPlayerEntityBridge) this.playerInventory.player).bridge$getBukkitEntity(), inventory, (LecternMenu) (Object) this);
        return bukkitEntity;
    }

    @Override
    public void bridge$setPlayerInventory(Inventory playerInventory) {
        this.playerInventory = playerInventory;
    }
}
