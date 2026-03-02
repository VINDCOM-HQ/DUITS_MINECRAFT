package io.github.netherdeck.common.mixin.core.world.level.levelgen.feature;

import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.feature.EndPlatformFeature;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.v.util.BlockStateListPopulator;
import org.bukkit.event.world.PortalCreateEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

import java.util.List;

@Mixin(EndPlatformFeature.class)
public class EndPlatformFeatureMixin {

    @Decorate(method = "createEndPlatform", inject = true, at = @At("HEAD"))
    private static void netherdeck$blockList(ServerLevelAccessor serverLevelAccessor,
                                           @Local(allocate = "blockList") BlockStateListPopulator blockList,
                                           @Local(allocate = "entity") Entity entity) throws Throwable {
        entity = NetherDeckCaptures.getEndPortalEntity();
        blockList = new BlockStateListPopulator(serverLevelAccessor);
        DecorationOps.blackhole().invoke(blockList, entity);
    }

    @Decorate(method = "createEndPlatform", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/ServerLevelAccessor;getBlockState(Lnet/minecraft/core/BlockPos;)Lnet/minecraft/world/level/block/state/BlockState;"))
    private static BlockState netherdeck$useBlockList1(ServerLevelAccessor instance, BlockPos pos, @Local(allocate = "blockList") BlockStateListPopulator blockList) throws Throwable {
        return (BlockState) DecorationOps.callsite().invoke((ServerLevelAccessor) blockList, pos);
    }

    @Decorate(method = "createEndPlatform", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/ServerLevelAccessor;destroyBlock(Lnet/minecraft/core/BlockPos;ZLnet/minecraft/world/entity/Entity;)Z"))
    private static boolean netherdeck$useBlockList2(ServerLevelAccessor instance, BlockPos pos, boolean b, Entity entity, @Local(allocate = "blockList") BlockStateListPopulator blockList) throws Throwable {
        return (boolean) DecorationOps.callsite().invoke((ServerLevelAccessor) blockList, pos, b, entity);
    }

    @Decorate(method = "createEndPlatform", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/ServerLevelAccessor;setBlock(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;I)Z"))
    private static boolean netherdeck$useBlockList3(ServerLevelAccessor instance, BlockPos pos, BlockState blockState, int i, @Local(allocate = "blockList") BlockStateListPopulator blockList) throws Throwable {
        return (boolean) DecorationOps.callsite().invoke((ServerLevelAccessor) blockList, pos, blockState, i);
    }

    @Decorate(method = "createEndPlatform", inject = true, at = @At("RETURN"))
    private static void netherdeck$portalCreate(ServerLevelAccessor serverLevelAccessor,
                                              @Local(allocate = "blockList") BlockStateListPopulator blockList,
                                              @Local(allocate = "entity") Entity entity) {
        if (entity != null) {
            var bworld = serverLevelAccessor.getLevel().bridge$getWorld();
            PortalCreateEvent portalEvent = new PortalCreateEvent((List<org.bukkit.block.BlockState>) (List) blockList.getList(), bworld, entity.bridge$getBukkitEntity(), org.bukkit.event.world.PortalCreateEvent.CreateReason.END_PLATFORM);

            Bukkit.getPluginManager().callEvent(portalEvent);
            if (!portalEvent.isCancelled()) {
                blockList.updateList();
            }
        }
    }

    @Decorate(method = "createEndPlatform", inject = true, at = @At("TAIL"))
    private static void netherdeck$dropItems(ServerLevelAccessor level, BlockPos pos, boolean flag, @Local(allocate = "blockList") BlockStateListPopulator blockList) {
        if (flag) {
            blockList.getList().forEach(state -> level.destroyBlock(state.getPosition(), true, null));
        }
        blockList.updateList();
    }
}
