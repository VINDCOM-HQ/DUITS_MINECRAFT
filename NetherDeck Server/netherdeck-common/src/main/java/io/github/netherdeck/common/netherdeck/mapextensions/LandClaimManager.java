package io.github.netherdeck.common.netherdeck.mapextensions;

import java.util.List;
import java.util.Map;

/**
 * Service layer for land claim region CRUD operations.
 *
 * <p>Regions are rectangular 2D polygons (X/Z plane) that are rendered as
 * coloured outlines on the web portal map. They can be created, listed, and
 * deleted by administrators via the web portal's region editor UI.
 *
 * <p>All persistence is delegated to {@link MapDatabaseService}, keeping this
 * class thin and testable.
 */
public final class LandClaimManager {

    private final MapDatabaseService db;

    public LandClaimManager(MapDatabaseService db) {
        this.db = db;
    }

    /**
     * Creates a new land claim region.
     *
     * @param name   display name shown on the map
     * @param world  dimension identifier (e.g. {@code minecraft_overworld})
     * @param minX   western boundary (block X)
     * @param minZ   northern boundary (block Z)
     * @param maxX   eastern boundary (block X)
     * @param maxZ   southern boundary (block Z)
     * @param color  hex colour string (e.g. {@code #3388ff})
     * @param owner  player name or faction name
     * @param type   region type tag (e.g. {@code claim}, {@code spawn}, {@code shop})
     * @return the new region's database id, or {@code -1} on failure
     */
    public int createRegion(String name, String world,
                             int minX, int minZ, int maxX, int maxZ,
                             String color, String owner, String type) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Region name must not be blank");
        }
        if (world == null || world.isBlank()) {
            throw new IllegalArgumentException("World must not be blank");
        }
        // Normalise so minX ≤ maxX and minZ ≤ maxZ
        int x1 = Math.min(minX, maxX);
        int x2 = Math.max(minX, maxX);
        int z1 = Math.min(minZ, maxZ);
        int z2 = Math.max(minZ, maxZ);

        return db.insertRegion(name, world, x1, z1, x2, z2, color, owner, type);
    }

    /**
     * Deletes a region by its database id.
     *
     * @param id the region id to delete
     */
    public void deleteRegion(int id) {
        if (id <= 0) {
            throw new IllegalArgumentException("Invalid region id: " + id);
        }
        db.deleteRegion(id);
    }

    /**
     * Returns all regions for a given world, or all regions if {@code world} is null.
     *
     * @param world dimension identifier, or {@code null} for all worlds
     * @return list of region data maps suitable for JSON serialisation
     */
    public List<Map<String, Object>> getRegionsForWorld(String world) {
        return db.getRegions(world);
    }
}
