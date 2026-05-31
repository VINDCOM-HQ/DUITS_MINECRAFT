package io.github.netherdeck.common.mod.util;

import io.github.netherdeck.common.bridge.core.world.item.crafting.RecipeManagerBridge;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.item.crafting.RecipeInput;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.craftbukkit.v.inventory.CraftComplexRecipe;
import org.bukkit.craftbukkit.v.inventory.CraftItemStack;
import org.bukkit.craftbukkit.v.util.CraftNamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

public class NetherDeckSpecialRecipe extends CraftComplexRecipe {

    private final Recipe<?> recipe;

    public NetherDeckSpecialRecipe(NamespacedKey id, Recipe<?> recipe) {
        super(id, new ItemStack(Material.AIR), null);
        this.recipe = recipe;
    }

    @Override
    public @NotNull ItemStack getResult() {
        return CraftItemStack.asCraftMirror(this.recipe.getResultItem(NetherDeckServer.getMinecraftServer().registryAccess()));
    }

    @Override
    public void addToCraftingManager() {
        ((RecipeManagerBridge) NetherDeckServer.getMinecraftServer().getRecipeManager()).bridge$addRecipe(new RecipeHolder<>(CraftNamespacedKey.toMinecraft(this.getKey()), this.recipe));
    }
}
