package io.github.netherdeck.common.mixin.core.world.level.chunk.storage;

import io.github.netherdeck.common.bridge.core.world.chunk.ChunkAccessBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.chunk.ChunkAccess;
import net.minecraft.world.level.chunk.storage.ChunkSerializer;
import org.bukkit.craftbukkit.v.persistence.CraftPersistentDataContainer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ChunkSerializer.class)
public class ChunkSerializerMixin {

    // TODO PalettedContainerRO is always PalettedContainer, which is RW

    @Decorate(method = "read", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/chunk/ChunkAccess;setLightCorrect(Z)V"))
    private static void netherdeck$loadPersistent(ChunkAccess instance, boolean correct, @Local(ordinal = -1) CompoundTag tag) throws Throwable {
        net.minecraft.nbt.Tag persistentBase = tag.get("ChunkBukkitValues");
        if (persistentBase instanceof CompoundTag) {
            ((CraftPersistentDataContainer) ((ChunkAccessBridge) instance).bridge$getPersistentDataContainer()).putAll((CompoundTag) persistentBase);
        }
        DecorationOps.callsite().invoke(instance, correct);
    }

    @Inject(method = "write", at = @At("RETURN"))
    private static void netherdeck$savePersistent(ServerLevel level, ChunkAccess chunkAccess, CallbackInfoReturnable<CompoundTag> cir) {
        var container = (CraftPersistentDataContainer) ((ChunkAccessBridge) chunkAccess).bridge$getPersistentDataContainer();
        if (!container.isEmpty()) {
            cir.getReturnValue().put("ChunkBukkitValues", container.toTagCompound());
        }
    }

    // unpackStructureStart CraftBukkit part implemented in StructureStart#loadStaticStart
}
