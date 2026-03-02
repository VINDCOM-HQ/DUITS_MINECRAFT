package io.github.netherdeck.common.mixin.vanilla.world.entity.animal;

import io.github.netherdeck.common.mixin.core.world.entity.animal.AnimalMixin;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.world.entity.animal.Fox;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

import java.util.List;

@Mixin(Fox.class)
public abstract class FoxMixin_Vanilla extends AnimalMixin {

    @Decorate(method = "dropAllDeathLoot", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/animal/Fox;spawnAtLocation(Lnet/minecraft/world/item/ItemStack;)Lnet/minecraft/world/entity/item/ItemEntity;"))
    private ItemEntity netherdeck$captureFoxDrop(Fox instance, ItemStack itemStack) throws Throwable {
        try {
            netherdeck$spawnNoAdd = true;
            final var result = (ItemEntity) DecorationOps.callsite().invoke(instance, itemStack);
            NetherDeckCaptures.captureExtraDrops(List.of(result));
            return result;
        } finally {
            netherdeck$spawnNoAdd = false;
        }
    }
}
