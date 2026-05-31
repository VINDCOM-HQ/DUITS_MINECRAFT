package io.github.netherdeck.common.mixin.bukkit;

import com.google.common.collect.ImmutableMap;
import io.github.netherdeck.common.bridge.bukkit.MaterialBridge;
import io.github.netherdeck.common.bridge.core.world.level.block.FireBlockBridge;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.i18n.LocalizedException;
import io.github.netherdeck.i18n.conf.MaterialPropertySpec;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.FallingBlock;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.BlockState;
import org.bukkit.craftbukkit.v.block.CraftBlock;
import org.bukkit.craftbukkit.v.block.CraftBlockState;
import org.bukkit.craftbukkit.v.block.CraftBlockStates;
import org.bukkit.craftbukkit.v.inventory.CraftMetaArmorStand;
import org.bukkit.craftbukkit.v.inventory.CraftMetaBanner;
import org.bukkit.craftbukkit.v.inventory.CraftMetaBlockState;
import org.bukkit.craftbukkit.v.inventory.CraftMetaBook;
import org.bukkit.craftbukkit.v.inventory.CraftMetaBookSigned;
import org.bukkit.craftbukkit.v.inventory.CraftMetaCharge;
import org.bukkit.craftbukkit.v.inventory.CraftMetaCrossbow;
import org.bukkit.craftbukkit.v.inventory.CraftMetaEnchantedBook;
import org.bukkit.craftbukkit.v.inventory.CraftMetaFirework;
import org.bukkit.craftbukkit.v.inventory.CraftMetaItem;
import org.bukkit.craftbukkit.v.inventory.CraftMetaKnowledgeBook;
import org.bukkit.craftbukkit.v.inventory.CraftMetaLeatherArmor;
import org.bukkit.craftbukkit.v.inventory.CraftMetaMap;
import org.bukkit.craftbukkit.v.inventory.CraftMetaPotion;
import org.bukkit.craftbukkit.v.inventory.CraftMetaSkull;
import org.bukkit.craftbukkit.v.inventory.CraftMetaSpawnEgg;
import org.bukkit.craftbukkit.v.inventory.CraftMetaSuspiciousStew;
import org.bukkit.craftbukkit.v.inventory.CraftMetaTropicalFishBucket;
import org.bukkit.craftbukkit.v.util.CraftMagicNumbers;
import org.bukkit.craftbukkit.v.util.CraftNamespacedKey;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.material.MaterialData;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.lang.reflect.Constructor;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.Function;

@Mixin(value = Material.class, remap = false)
public abstract class MaterialMixin implements MaterialBridge {

    // @formatter:off
    @Shadow @Mutable @Final private NamespacedKey key;
    @Shadow @Mutable @Final private Constructor<? extends MaterialData> ctor;
    @Shadow @Mutable @Final public Class<?> data;
    @Shadow public abstract boolean isBlock();
    // @formatter:on

    private static final Map<String, BiFunction<Material, CraftMetaItem, ItemMeta>> TYPES = ImmutableMap
        .<String, BiFunction<Material, CraftMetaItem, ItemMeta>>builder()
        .put("ARMOR_STAND", (a, b) -> b instanceof CraftMetaArmorStand ? b : new CraftMetaArmorStand(b))
        .put("BANNER", (a, b) -> b instanceof CraftMetaBanner ? b : new CraftMetaBanner(b))
        .put("TILE_ENTITY", (a, b) -> new CraftMetaBlockState(b, a))
        .put("BOOK", (a, b) -> b != null && b.getClass().equals(CraftMetaBook.class) ? b : new CraftMetaBook(b))
        .put("BOOK_SIGNED", (a, b) -> b instanceof CraftMetaBookSigned ? b : new CraftMetaBookSigned(b))
        .put("SKULL", (a, b) -> b instanceof CraftMetaSkull ? b : new CraftMetaSkull(b))
        .put("LEATHER_ARMOR", (a, b) -> b instanceof CraftMetaLeatherArmor ? b : new CraftMetaLeatherArmor(b))
        .put("MAP", (a, b) -> b instanceof CraftMetaMap ? b : new CraftMetaMap(b))
        .put("POTION", (a, b) -> b instanceof CraftMetaPotion ? b : new CraftMetaPotion(b))
        .put("SPAWN_EGG", (a, b) -> b instanceof CraftMetaSpawnEgg ? b : new CraftMetaSpawnEgg(b))
        .put("ENCHANTED", (a, b) -> b instanceof CraftMetaEnchantedBook ? b : new CraftMetaEnchantedBook(b))
        .put("FIREWORK", (a, b) -> b instanceof CraftMetaFirework ? b : new CraftMetaFirework(b))
        .put("FIREWORK_EFFECT", (a, b) -> b instanceof CraftMetaCharge ? b : new CraftMetaCharge(b))
        .put("KNOWLEDGE_BOOK", (a, b) -> b instanceof CraftMetaKnowledgeBook ? b : new CraftMetaKnowledgeBook(b))
        .put("TROPICAL_FISH_BUCKET", (a, b) -> b instanceof CraftMetaTropicalFishBucket ? b : new CraftMetaTropicalFishBucket(b))
        .put("CROSSBOW", (a, b) -> b instanceof CraftMetaCrossbow ? b : new CraftMetaCrossbow(b))
        .put("SUSPICIOUS_STEW", (a, b) -> b instanceof CraftMetaSuspiciousStew ? b : new CraftMetaSuspiciousStew(b))
        .put("UNSPECIFIC", (a, b) -> new CraftMetaItem(b))
        .put("NULL", (a, b) -> null)
        .build();

    private MaterialPropertySpec.MaterialType netherdeck$type = MaterialPropertySpec.MaterialType.VANILLA;
    private MaterialPropertySpec netherdeck$spec;
    private ResourceLocation netherdeck$location;
    private boolean netherdeck$block = false, netherdeck$item = false;

    @Override
    public void bridge$setBlock() {
        this.netherdeck$block = true;
    }

    @Override
    public void bridge$setItem() {
        this.netherdeck$item = true;
    }

    @Inject(method = "isBlock", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isBlock(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$type != MaterialPropertySpec.MaterialType.VANILLA) {
            cir.setReturnValue(netherdeck$block);
        }
    }

    @Inject(method = "isItem", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isItem(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$type != MaterialPropertySpec.MaterialType.VANILLA) {
            cir.setReturnValue(netherdeck$item);
        }
    }

    @Inject(method = "isEdible", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isEdible(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.edible);
        }
    }

    @Inject(method = "isRecord", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isRecord(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.record);
        }
    }

    @Inject(method = "isSolid", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isSolid(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.solid);
        }
    }

    @Inject(method = "isAir", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isAir(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.air);
        }
    }

    @Inject(method = "isTransparent", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isTransparent(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.transparent);
        }
    }

    @Inject(method = "isFlammable", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isFlammable(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.flammable);
        }
    }

    @Inject(method = "isBurnable", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isBurnable(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.burnable);
        }
    }

    @Inject(method = "isFuel", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isFuel(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.fuel);
        }
    }

    @Inject(method = "isOccluding", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isOccluding(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.occluding);
        }
    }

    @Inject(method = "hasGravity", cancellable = true, at = @At("HEAD"))
    private void netherdeck$hasGravity(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.gravity);
        }
    }

    @Inject(method = "isInteractable", cancellable = true, at = @At("HEAD"))
    private void netherdeck$isInteractable(CallbackInfoReturnable<Boolean> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.interactable);
        }
    }

    @Inject(method = "getHardness", cancellable = true, at = @At("HEAD"))
    private void netherdeck$getHardness(CallbackInfoReturnable<Float> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.hardness);
        }
    }

    @Inject(method = "getBlastResistance", cancellable = true, at = @At("HEAD"))
    private void netherdeck$getBlastResistance(CallbackInfoReturnable<Float> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.blastResistance);
        }
    }

    @Inject(method = "getMaxStackSize", cancellable = true, at = @At("HEAD"))
    private void netherdeck$getMaxStackSize(CallbackInfoReturnable<Integer> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            cir.setReturnValue(netherdeck$spec.maxStack);
        }
    }

    @Inject(method = "getMaxDurability", cancellable = true, at = @At("HEAD"))
    private void netherdeck$getMaxDurability(CallbackInfoReturnable<Short> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            if (netherdeck$spec.maxDurability != null) {
                cir.setReturnValue(netherdeck$spec.maxDurability.shortValue());
            }
        }
    }

    @Inject(method = "getCraftingRemainingItem", cancellable = true, at = @At("HEAD"))
    private void netherdeck$getCraftingRemainingItem(CallbackInfoReturnable<Material> cir) {
        if (netherdeck$spec != null) {
            if (!netherdeck$spec.isPresent) {
                netherdeck$setupCommon();
            }
            if (netherdeck$spec.craftingRemainingItem != null) {
                cir.setReturnValue(CraftMagicNumbers.getMaterial(BuiltInRegistries.ITEM.get(ResourceLocation.parse(netherdeck$spec.craftingRemainingItem))));
            }
        }
    }

    @Override
    public MaterialPropertySpec bridge$getSpec() {
        return netherdeck$spec;
    }

    @Override
    public MaterialPropertySpec.MaterialType bridge$getType() {
        return netherdeck$type;
    }

    private Function<CraftMetaItem, ItemMeta> netherdeck$metaFunc;

    @Override
    public Function<CraftMetaItem, ItemMeta> bridge$itemMetaFactory() {
        if (netherdeck$metaFunc == null && !netherdeck$spec.isPresent) {
            netherdeck$setupCommon();
        }
        return netherdeck$metaFunc;
    }

    @Override
    public void bridge$setItemMetaFactory(Function<CraftMetaItem, ItemMeta> func) {
        this.netherdeck$metaFunc = func;
    }

    private Function<CraftBlock, BlockState> netherdeck$stateFunc;

    @Override
    public Function<CraftBlock, BlockState> bridge$blockStateFactory() {
        if (netherdeck$stateFunc == null && !netherdeck$spec.isPresent) {
            netherdeck$setupCommon();
        }
        return netherdeck$stateFunc;
    }

    @Override
    public void bridge$setBlockStateFactory(Function<CraftBlock, BlockState> func) {
        this.netherdeck$stateFunc = func;
    }

    @Override
    public void bridge$setupBlock(ResourceLocation key, MaterialPropertySpec spec) {
        this.netherdeck$spec = spec.clone();
        netherdeck$type = MaterialPropertySpec.MaterialType.FORGE;
        netherdeck$block = true;
        netherdeck$setupCommonLazy(key);
    }

    @Override
    public void bridge$setupVanillaBlock(MaterialPropertySpec spec) {
        if (spec.isPresent) {
            this.netherdeck$spec = spec.clone();
            this.setupBlockStateFunc();
        }
    }

    @Override
    public void bridge$setupItem(ResourceLocation key, MaterialPropertySpec spec) {
        this.netherdeck$spec = spec.clone();
        netherdeck$type = MaterialPropertySpec.MaterialType.FORGE;
        netherdeck$item = true;
        netherdeck$setupCommonLazy(key);
    }

    @Override
    public boolean bridge$shouldApplyStateFactory() {
        return this.netherdeck$type != MaterialPropertySpec.MaterialType.VANILLA ||
            (this.netherdeck$spec != null && this.netherdeck$spec.blockStateClass != null);
    }

    @SuppressWarnings("unchecked")
    private void netherdeck$setupCommonLazy(ResourceLocation key) {
        this.key = CraftNamespacedKey.fromMinecraft(key);
        if (netherdeck$spec.materialDataClass != null) {
            try {
                Class<?> data = Class.forName(netherdeck$spec.materialDataClass);
                if (MaterialData.class.isAssignableFrom(data)) {
                    this.data = data;
                    this.ctor = (Constructor<? extends MaterialData>) data.getConstructor(Material.class, byte.class);
                }
            } catch (Exception e) {
                NetherDeckServer.LOGGER.warn("Bad material data class {} for {}", netherdeck$spec.materialDataClass, this);
                NetherDeckServer.LOGGER.warn(e);
            }
        }
        netherdeck$location = key;
    }

    private void netherdeck$setupCommon() {
        Block block = BuiltInRegistries.BLOCK.get(netherdeck$location);
        Item item = BuiltInRegistries.ITEM.get(netherdeck$location);

        // Block properties
        if (netherdeck$location.equals(MaterialBridge.AIR) || block != Blocks.AIR) {
            if (netherdeck$spec.solid == null) {
                netherdeck$spec.solid = block.defaultBlockState().canOcclude();
            }
            if (netherdeck$spec.air == null) {
                netherdeck$spec.air = block.defaultBlockState().isAir();
            }
            if (netherdeck$spec.transparent == null) {
                netherdeck$spec.transparent = block.defaultBlockState().useShapeForLightOcclusion();
            }
            if (netherdeck$spec.flammable == null) {
                netherdeck$spec.flammable = ((FireBlockBridge) Blocks.FIRE).bridge$canBurn(block);
            }
            if (netherdeck$spec.burnable == null) {
                netherdeck$spec.burnable = ((FireBlockBridge) Blocks.FIRE).bridge$canBurn(block);
            }
            if (netherdeck$spec.hardness == null) {
                netherdeck$spec.hardness = block.defaultBlockState().destroySpeed;
            }
            if (netherdeck$spec.blastResistance == null) {
                netherdeck$spec.blastResistance = block.getExplosionResistance();
            }
        }

        // Item properties
        if (netherdeck$spec.maxStack == null) {
            netherdeck$spec.maxStack = bridge$forge$getMaxStackSize(item);
        }
        if (netherdeck$spec.maxDurability == null) {
            netherdeck$spec.maxDurability = bridge$forge$getDurability(item);
        }
        if (netherdeck$spec.edible == null) {
            netherdeck$spec.edible = false;
        }
        if (netherdeck$spec.record == null) {
            netherdeck$spec.record = false;
        }
        if (netherdeck$spec.fuel == null) {
            netherdeck$spec.fuel = bridge$forge$getBurnTime(item) > 0;
        }
        if (netherdeck$spec.occluding == null) {
            netherdeck$spec.occluding = netherdeck$spec.solid;
        }
        if (netherdeck$spec.gravity == null) {
            netherdeck$spec.gravity = block instanceof FallingBlock;
        }
        if (netherdeck$spec.interactable == null) {
            netherdeck$spec.interactable = true;
        }
        if (netherdeck$spec.craftingRemainingItem == null) {
            // noinspection deprecation
            final var remaining = bridge$getCraftRemainingItem(item);
            netherdeck$spec.craftingRemainingItem = remaining != null ? remaining.toString() : null;
        }
        if (netherdeck$spec.itemMetaType == null) {
            netherdeck$spec.itemMetaType = "UNSPECIFIC";
        }
        netherdeck$spec.present();

        BiFunction<Material, CraftMetaItem, ItemMeta> function = TYPES.get(netherdeck$spec.itemMetaType);
        if (function != null) {
            this.netherdeck$metaFunc = meta -> function.apply((Material) (Object) this, meta);
        } else {
            this.netherdeck$metaFunc = dynamicMetaCreator(netherdeck$spec.itemMetaType);
        }
        this.setupBlockStateFunc();
    }

    private void setupBlockStateFunc() {
        if (netherdeck$spec.blockStateClass != null && !netherdeck$spec.blockStateClass.equalsIgnoreCase("auto")) {
            try {
                Class<?> cl = Class.forName(netherdeck$spec.blockStateClass);
                if (!CraftBlockState.class.isAssignableFrom(cl)) {
                    throw LocalizedException.checked("registry.block-state.not-subclass", cl, CraftBlockState.class);
                }
                for (Constructor<?> constructor : cl.getDeclaredConstructors()) {
                    if (constructor.getParameterTypes().length == 1
                        && org.bukkit.block.Block.class.isAssignableFrom(constructor.getParameterTypes()[0])) {
                        constructor.setAccessible(true);
                        this.netherdeck$stateFunc = b -> {
                            try {
                                return (BlockState) constructor.newInstance(b);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        };
                    }
                }
            } catch (Exception e) {
                if (e instanceof LocalizedException) {
                    NetherDeckServer.LOGGER.warn(((LocalizedException) e).node(), ((LocalizedException) e).args());
                } else {
                    NetherDeckServer.LOGGER.warn("registry.block-state.error", this, netherdeck$spec.blockStateClass, e);
                }
            }
            if (this.netherdeck$stateFunc == null) {
                NetherDeckServer.LOGGER.warn("registry.block-state.no-candidate", this, netherdeck$spec.blockStateClass);
            }
        }
        if (this.netherdeck$stateFunc == null) {
            this.netherdeck$stateFunc = CraftBlockStates::getBlockState;
        }
    }

    private Function<CraftMetaItem, ItemMeta> dynamicMetaCreator(String type) {
        Function<CraftMetaItem, ItemMeta> candidate = null;
        try {
            Class<?> cl = Class.forName(type);
            if (!CraftMetaItem.class.isAssignableFrom(cl)) {
                throw LocalizedException.checked("registry.meta-type.not-subclass", cl, CraftMetaItem.class);
            }
            for (Constructor<?> constructor : cl.getDeclaredConstructors()) {
                Class<?>[] parameterTypes = constructor.getParameterTypes();
                if (parameterTypes.length == 1) {
                    if (parameterTypes[0] == Material.class) {
                        constructor.setAccessible(true);
                        candidate = meta -> {
                            try {
                                return (ItemMeta) constructor.newInstance(this);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        };
                        break;
                    } else if (CraftMetaItem.class.isAssignableFrom(parameterTypes[0])) {
                        constructor.setAccessible(true);
                        candidate = meta -> {
                            try {
                                return (ItemMeta) constructor.newInstance(meta);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        };
                        break;
                    }
                } else if (parameterTypes.length == 2) {
                    if (parameterTypes[0] == Material.class && CraftMetaItem.class.isAssignableFrom(parameterTypes[1])) {
                        constructor.setAccessible(true);
                        candidate = meta -> {
                            try {
                                return (ItemMeta) constructor.newInstance(this, meta);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        };
                        break;
                    } else if (parameterTypes[1] == Material.class && CraftMetaItem.class.isAssignableFrom(parameterTypes[0])) {
                        constructor.setAccessible(true);
                        candidate = meta -> {
                            try {
                                return (ItemMeta) constructor.newInstance(meta, this);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        };
                        break;
                    }
                }
            }
        } catch (Exception e) {
            if (e instanceof LocalizedException) {
                NetherDeckServer.LOGGER.warn(((LocalizedException) e).node(), ((LocalizedException) e).args());
            } else {
                NetherDeckServer.LOGGER.warn("registry.meta-type.error", this, type, e);
            }
        }
        if (candidate == null) {
            NetherDeckServer.LOGGER.warn("registry.meta-type.no-candidate", this, type);
            candidate = CraftMetaItem::new;
        }
        return candidate;
    }
}
