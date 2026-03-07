# World Map Configuration

The NetherDeck Map is a built-in 3D world map feature powered by BlueMap Core (MIT licensed). It renders Minecraft worlds as browsable tile maps accessible through the web portal.

## Enabling

### In `netherdeck.yml` (standalone)

```yaml
world-map:
  enabled: true
```

### In Docker (via environment variable)

```ini
ENABLE_WORLD_MAP=true    # default in Docker
```

The Docker entrypoint patches `netherdeck.yml` based on this variable. Set to `false` to disable.

## Configuration Reference

All settings live under the `world-map:` section of `netherdeck.yml`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the world map feature |
| `http-port` | int | `8100` | Port for the map HTTP server |
| `http-bind` | string | `127.0.0.1` | Bind address for the map HTTP server |
| `render-threads` | int | `2` | Number of threads for chunk rendering |
| `render-distance` | int | `128` | Chunk render radius from spawn |
| `update-interval` | int | `30` | Seconds between render cycles |
| `dimensions.overworld` | boolean | `true` | Render the overworld |
| `dimensions.nether` | boolean | `true` | Render the nether |
| `dimensions.the-end` | boolean | `true` | Render the end |

### Example

```yaml
world-map:
  enabled: true
  http-port: 8100
  http-bind: 127.0.0.1
  render-threads: 2
  render-distance: 128
  update-interval: 30
  dimensions:
    overworld: true
    nether: true
    the-end: true
```

## Web Portal Integration

The web portal proxies map data from the Java map HTTP server so users can view the map through the authenticated portal without exposing port 8100 directly.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_PORTAL_MAP_HOST` | `127.0.0.1` | Host where the Java map HTTP server is running |
| `WEB_PORTAL_MAP_PORT` | `8100` | Port of the Java map HTTP server |

These should match the `http-bind` and `http-port` values in `netherdeck.yml`.

### Portal Routes

| Route | Purpose |
|-------|---------|
| `/map` | Map viewer page |
| `/api/map/metadata` | Proxied map world metadata |
| `/api/map/players` | Proxied live player positions |
| `/api/map/tiles/[...path]` | Proxied rendered tile images |

## Architecture

```
MC Server (Java)
  └── MapService
        ├── Adapters (World, Player, Plugin → BlueMap Core API)
        ├── RenderScheduler (chunk rendering on server thread)
        └── MapHttpServer (:8100)
              ├── /maps                    → list of maps
              ├── /maps/{id}/tiles/...     → rendered tile images
              └── /maps/{id}/players       → live player positions

Web Portal (:3000)
  └── /map page
        ├── /api/map/tiles/[...path]   → proxy to MapHttpServer
        ├── /api/map/metadata          → proxy to MapHttpServer
        └── /api/map/players           → proxy to MapHttpServer
```

Tiles are rendered by BlueMap Core into an in-memory tile store and served over a lightweight HTTP server. The web portal proxies these endpoints so the map is accessible through the authenticated portal.

## Performance Notes

- **Render threads**: More threads = faster initial render but higher CPU usage. 2 is a good default for most servers.
- **Render distance**: Larger values render more of the world but take longer and use more memory. 128 chunks covers a ~2km radius from spawn.
- **Update interval**: Lower values keep the map fresher but increase server load. 30 seconds is a good balance.
- **Dimension toggles**: Disable dimensions you don't need to save rendering resources.
