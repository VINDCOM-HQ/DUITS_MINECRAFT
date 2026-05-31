package io.github.netherdeck.common.mixin.netherdeck.collections;

import it.unimi.dsi.fastutil.ints.Int2ObjectOpenHashMap;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.entity.EntityAccess;
import net.minecraft.world.level.entity.EntitySection;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Paper-style fastutil collection replacement for EntitySection.
 * Uses Int2ObjectOpenHashMap for entity ID lookups instead of HashMap.
 * Eliminates Integer boxing overhead in entity ID-based lookups which happen
 * thousands of times per tick during entity processing.
 *
 * EntitySection<T extends EntityAccess> is generic - we use the erased type
 * EntityAccess to match method signatures correctly.
 */
@Mixin(EntitySection.class)
public abstract class EntitySectionMixin_FastutilCollections {

    /**
     * Fast entity lookup by integer ID without boxing.
     * Int2ObjectOpenHashMap avoids autoboxing int->Integer on every lookup.
     */
    @Unique
    private final Int2ObjectOpenHashMap<Entity> netherdeck$entityByIdFast = new Int2ObjectOpenHashMap<>();

    /**
     * Track entities in our fast map when added to a section.
     * Uses EntityAccess as the parameter type to match the erased generic signature.
     */
    @Inject(method = "add", at = @At("TAIL"))
    private void netherdeck$addToFastMap(EntityAccess entity, CallbackInfo ci) {
        if (entity instanceof Entity e) {
            netherdeck$entityByIdFast.put(e.getId(), e);
        }
    }

    /**
     * Remove entities from our fast map when removed from a section.
     * Uses EntityAccess as the parameter type to match the erased generic signature.
     */
    @Inject(method = "remove", at = @At("TAIL"))
    private void netherdeck$removeFromFastMap(EntityAccess entity, CallbackInfoReturnable<?> cir) {
        if (entity instanceof Entity e) {
            netherdeck$entityByIdFast.remove(e.getId());
        }
    }

    /**
     * Provide fast entity lookup by integer ID.
     * Used by other NetherDeck optimization mixins.
     */
    @Unique
    public Entity netherdeck$getEntityByIdFast(int id) {
        return netherdeck$entityByIdFast.get(id);
    }
}
