# NetherDeck Server Development

NetherDeck Server is a hybrid NeoForge + Paper server fork based on Arclight, targeting Minecraft 1.21.1. It merges NeoForge mod support with Paper plugin support and Paper's performance optimizations.

## Build Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 21 (Temurin recommended) | Must be set as `JAVA_HOME` |
| Git | Latest | Must be on `PATH` — required by BuildTools for Spigot compilation |
| Disk | ~5 GB | For Gradle caches + BuildTools artifacts |

## Build Commands

```bash
cd "NetherDeck Server"

# Set environment (example for Windows/MSYS2)
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
export PATH="/c/Program Files/Git/cmd:$PATH"

# Full build
./gradlew build --no-daemon

# Clean build
./gradlew clean build --no-daemon
```

Build outputs (~11 MB each):
- `build/libs/netherdeck-forge-*.jar`
- `build/libs/netherdeck-neoforge-*.jar`
- `build/libs/netherdeck-fabric-*.jar`

The build runs ~79 Gradle tasks including BuildTools (Spigot compilation), mixin processing, and JAR assembly for all three platforms.

## Module Breakdown

### Core Modules

| Module | Purpose |
|--------|---------|
| `netherdeck-common` | Shared code — config system, 680+ mixins, world map, core patches |
| `netherdeck-neoforge` | NeoForge 21.1.216 platform adapter |
| `netherdeck-forge` | Legacy Forge platform adapter |
| `netherdeck-fabric` | Fabric platform adapter |
| `netherdeck-bootstrap` | Bootstrap class loader |
| `netherdeck-installer` | Server installer |

### Build Infrastructure

| Module | Purpose |
|--------|---------|
| `buildSrc` | Custom Gradle plugin (`NetherDeckGradlePlugin.groovy`) — remapping, JAR assembly, BuildTools integration |

### Libraries (Source)

| Module | Purpose |
|--------|---------|
| `libraries/netherdeck-api` | Public API for plugin/mod developers |
| `libraries/netherdeck-mixin-tools` | Mixin utility classes |
| `libraries/netherdeck-tools` | Build-time tools |

### Libraries (Vendored JARs)

| Library | License | Purpose |
|---------|---------|---------|
| BlueMap Core (9 JARs) | MIT | World map rendering engine |

Located in `libraries/bluemap/`. Referenced via `fileTree` in Gradle — no external Maven repository needed.

JARs: `bluemap-api`, `bluemap-core`, `bluemap-common`, `bluenbt`, `aircompressor`, `caffeine`, `commons-dbcp2`, `configurate-gson`, `lz4-java`

## Mixin System

NetherDeck uses SpongePowered Mixin to patch Minecraft and NeoForge classes at runtime.

### Scale

- **680+ mixin classes** across the codebase
- **11 mixin config files** in `netherdeck-common/src/main/resources/`

### Config Files

```
mixins.netherdeck.core.json
mixins.netherdeck.bukkit.json
mixins.netherdeck.forge.json
mixins.netherdeck.optimization.json
mixins.netherdeck.worldmap.json
... (6 more)
```

### Key Patterns

**@Inject** — inject code at method entry, return, or specific instructions:
```java
@Inject(method = "tick", at = @At("HEAD"))
private void onTick(CallbackInfo ci) {
    // Runs at the start of every server tick
}
```

**@Overwrite** — replace an entire method (use sparingly):
```java
@Overwrite
public void someMethod() {
    // Complete replacement
}
```

**@Shadow** — access private fields from the target class:
```java
@Shadow private ServerLevel level;
```

**@Redirect** — replace a single method call within a target method:
```java
@Redirect(method = "foo", at = @At(value = "INVOKE", target = "Lsome/Class;bar()V"))
private void redirectBar(SomeClass instance) {
    // Replace the call to bar()
}
```

### Gotchas

- Static mixin methods cannot use `instanceof` on the mixin class — use `(MixinClass)(Object)target` cast.
- Use `@Shadow` for non-public fields (e.g., `ServerChunkCache.level`).
- Use erased types for generics (e.g., `EntityAccess` not `Entity` for `EntitySection<T>`).
- Don't inject into methods that already have `@Overwrite` in core mixins.
- Interface `@Inject` into default methods is fragile — avoid.

## Config System

Server configuration lives in `netherdeck.yml`, loaded by `NetherDeckConfig.java`:

```
netherdeck-common/src/main/java/io/github/netherdeck/NetherDeckConfig.java
```

The config file is generated on first run and read on server startup. It controls NetherDeck-specific behaviour including the world map feature.

### World Map Config Section

```yaml
world-map:
  enabled: false          # Opt-in — must explicitly enable
  http-port: 8100         # Map tile server port
  render-distance: 100    # Chunk render radius
  render-interval: 300    # Seconds between render cycles
```

## World Map Architecture

The world map feature uses BlueMap Core (MIT licensed) as a rendering engine, fully vendored as local JARs.

### Components

| Class | Purpose |
|-------|---------|
| `NetherDeckMapService` | Lifecycle manager — init, render scheduling, shutdown |
| `NetherDeckMapWorld` | Adapter: MC world → BlueMap World API |
| `NetherDeckMapPlayer` | Adapter: MC player → BlueMap Player API |
| `NetherDeckMapPlugin` | Adapter: NetherDeck → BlueMap Plugin API |
| `NetherDeckMapHttpServer` | Lightweight HTTP server for tiles + metadata |
| Render scheduler | Runs on server thread, renders chunks on interval |

### Data Flow

```
MC Server Thread
  └── RenderScheduler (every N seconds)
        └── BlueMap Core renders chunks → in-memory tile store

MapHttpServer (:8100)
  ├── GET /maps                      → list of maps
  ├── GET /maps/{id}/tiles/...       → rendered tile images
  └── GET /maps/{id}/players         → live player positions

Web Portal (:3000)
  └── /api/map/* routes proxy to MapHttpServer
```

### Mixin Hook

The world map integrates via `mixins.netherdeck.worldmap.json`:

- Hooks `MinecraftServer.createLevels()` at `RETURN` to start the map service after worlds load.
- Hooks `MinecraftServer.stopServer()` at `HEAD` to shut down the map service cleanly.

## Package Namespace

All source code lives under `io.github.netherdeck.*`:

```
io.github.netherdeck.NetherDeckConfig
io.github.netherdeck.mod.NetherDeckConnector
io.github.netherdeck.worldmap.NetherDeckMapService
io.github.netherdeck.gradle.NetherDeckGradlePlugin
```

The mod ID is `netherdeck`. Cache directory is `.gradle/netherdeck/`.

## CI/CD

### Build Workflow (`NetherDeck Server/.github/workflows/build.yml`)

| Trigger | Action |
|---------|--------|
| Push to any branch | Build all platform JARs |
| Pull request | Build + verify |
| Release tag | Build + attach JARs to GitHub Release |

The workflow:
1. Sets up Java 21 (Temurin)
2. Caches Gradle dependencies and BuildTools output
3. Runs `./gradlew build`
4. Uploads platform JARs as artifacts

### Related Root Workflows

| Workflow | File | Relevance |
|----------|------|-----------|
| Docker Build | `.github/workflows/docker-build.yml` | Builds the container image (doesn't include NetherDeck Server) |
| Security Scans | `.github/workflows/security-scan.yml` | Trivy + Semgrep + TruffleHog on push and weekly schedule |
