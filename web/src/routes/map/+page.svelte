<script>
	import { mapMetadata, mapPlayers, mapTileUrl } from '$lib/api.js';
	import MapContainer from '$lib/components/map/MapContainer.svelte';
	import MapLayerControls from '$lib/components/map/MapLayerControls.svelte';
	import MapPlayerSidebar from '$lib/components/map/MapPlayerSidebar.svelte';
	import MapMarkerPopup from '$lib/components/map/MapMarkerPopup.svelte';
	import MapRegionEditor from '$lib/components/map/MapRegionEditor.svelte';

	// -------------------------------------------------------------------------
	// Core state
	// -------------------------------------------------------------------------

	let metadata = $state(null);
	let players = $state([]);
	let mapServerOnline = $state(false);
	let selectedWorld = $state('');

	// Canvas state
	let canvasEl = $state(null);
	let offsetX = $state(0);
	let offsetZ = $state(0);
	let zoom = $state(1);
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartZ = $state(0);
	let mouseWorldX = $state(0);
	let mouseWorldZ = $state(0);

	// -------------------------------------------------------------------------
	// Layer state
	// -------------------------------------------------------------------------

	let layers = $state({
		trails: false,
		deaths: false,
		respawns: false,
		regions: false,
		heatmap: false
	});

	// Layer data
	let trailData = $state([]);
	let deathMarkers = $state([]);
	let respawnMarkers = $state([]);
	let regionData = $state([]);
	let heatmapData = $state([]);

	// UI state
	let activeMarker = $state(null);
	let showRegionEditor = $state(false);

	// -------------------------------------------------------------------------
	// Tile system constants
	// -------------------------------------------------------------------------

	const TILE_SIZE = 256;
	const MAX_CACHE_SIZE = 500;
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 10;
	const ZOOM_IN_FACTOR = 1.1;
	const ZOOM_OUT_FACTOR = 0.9;
	const BLOCK_GRID_MIN_PX = 4;
	const CHUNK_GRID_MIN_PX = 8;
	const PLAYER_DOT_RADIUS = 4;

	const tileCache = new Map();
	let animFrameId = 0;

	const DEFAULT_METADATA = {
		worlds: [{ id: 'overworld', name: 'Overworld', spawn: { x: 0, z: 0 } }]
	};

	// -------------------------------------------------------------------------
	// Layer toggle
	// -------------------------------------------------------------------------

	function toggleLayer(key) {
		layers = { ...layers, [key]: !layers[key] };
	}

	// -------------------------------------------------------------------------
	// Tile helpers
	// -------------------------------------------------------------------------

	function getTileZoomLevel(canvasZoom) {
		if (canvasZoom >= 0.5) return 0;
		if (canvasZoom >= 0.25) return 1;
		if (canvasZoom >= 0.125) return 2;
		return 3;
	}

	function tileWorldSize(tileZoom) {
		return TILE_SIZE * Math.pow(2, tileZoom);
	}

	function scheduleRender() {
		cancelAnimationFrame(animFrameId);
		animFrameId = requestAnimationFrame(renderCanvas);
	}

	function loadTile(worldId, tileZoom, tx, tz) {
		const key = `${worldId}/${tileZoom}/${tx}_${tz}`;
		const cached = tileCache.get(key);
		if (cached) {
			tileCache.delete(key);
			tileCache.set(key, cached);
			return cached;
		}

		if (tileCache.size >= MAX_CACHE_SIZE) {
			const firstKey = tileCache.keys().next().value;
			tileCache.delete(firstKey);
		}

		const entry = { img: new Image(), loaded: false };
		entry.img.onload = () => {
			tileCache.set(key, { ...entry, loaded: true });
			scheduleRender();
		};
		entry.img.onerror = () => {
			tileCache.delete(key);
		};
		entry.img.src = mapTileUrl(worldId, tileZoom, tx, tz);
		tileCache.set(key, entry);
		return entry;
	}

	function normalizeWorldId(name) {
		return name.replace(/^minecraft[_:]/, '').replace(':', '_');
	}

	// -------------------------------------------------------------------------
	// Drawing layers
	// -------------------------------------------------------------------------

	function drawTiles(ctx, width, height) {
		if (!mapServerOnline || !selectedWorld) return;

		const tileZoom = getTileZoomLevel(zoom);
		const worldPerTile = tileWorldSize(tileZoom);
		const tileSizeOnScreen = worldPerTile * zoom;

		const worldLeft = -offsetX - width / 2 / zoom;
		const worldTop = -offsetZ - height / 2 / zoom;
		const worldRight = -offsetX + width / 2 / zoom;
		const worldBottom = -offsetZ + height / 2 / zoom;

		const tileMinX = Math.floor(worldLeft / worldPerTile);
		const tileMinZ = Math.floor(worldTop / worldPerTile);
		const tileMaxX = Math.floor(worldRight / worldPerTile);
		const tileMaxZ = Math.floor(worldBottom / worldPerTile);

		for (let tx = tileMinX; tx <= tileMaxX; tx++) {
			for (let tz = tileMinZ; tz <= tileMaxZ; tz++) {
				const tile = loadTile(selectedWorld, tileZoom, tx, tz);
				if (tile.loaded) {
					const screenX = (tx * worldPerTile + offsetX) * zoom + width / 2;
					const screenZ = (tz * worldPerTile + offsetZ) * zoom + height / 2;
					ctx.drawImage(tile.img, screenX, screenZ, tileSizeOnScreen, tileSizeOnScreen);
				}
			}
		}
	}

	function drawTrails(ctx, width, height) {
		if (!layers.trails || trailData.length === 0) return;

		// Group trail points by uuid for polyline drawing
		const byUuid = new Map();
		for (const pt of trailData) {
			const currentWorldId = normalizeWorldId(selectedWorld);
			const trailWorldId = normalizeWorldId(pt.world || '');
			if (currentWorldId && trailWorldId !== currentWorldId) continue;

			const pts = byUuid.get(pt.uuid) || [];
			pts.push(pt);
			byUuid.set(pt.uuid, pts);
		}

		ctx.save();
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.6;

		// Cycle through hues for different players
		const hues = [280, 200, 60, 120, 0, 30];
		let hueIdx = 0;

		for (const [, pts] of byUuid) {
			if (pts.length < 2) continue;

			// Sort by timestamp
			const sorted = [...pts].sort((a, b) => a.t - b.t);

			const hue = hues[hueIdx % hues.length];
			hueIdx++;
			ctx.strokeStyle = `hsl(${hue}, 80%, 65%)`;
			ctx.beginPath();

			for (let i = 0; i < sorted.length; i++) {
				const sx = sorted[i].x * zoom + offsetX * zoom + width / 2;
				const sz = sorted[i].z * zoom + offsetZ * zoom + height / 2;
				if (i === 0) ctx.moveTo(sx, sz);
				else ctx.lineTo(sx, sz);
			}
			ctx.stroke();
		}

		ctx.restore();
	}

	function drawDeathMarkers(ctx, width, height) {
		if (!layers.deaths || deathMarkers.length === 0) return;

		const currentWorldId = normalizeWorldId(selectedWorld);
		ctx.save();
		ctx.font = '14px monospace';
		ctx.textAlign = 'center';

		for (const m of deathMarkers) {
			const markerWorldId = normalizeWorldId(m.world || '');
			if (currentWorldId && markerWorldId !== currentWorldId) continue;

			const sx = m.x * zoom + offsetX * zoom + width / 2;
			const sz = m.z * zoom + offsetZ * zoom + height / 2;

			ctx.fillStyle = '#ef4444';
			ctx.fillText('☠', sx, sz);
		}

		ctx.restore();
	}

	function drawRespawnMarkers(ctx, width, height) {
		if (!layers.respawns || respawnMarkers.length === 0) return;

		const currentWorldId = normalizeWorldId(selectedWorld);
		ctx.save();
		ctx.font = '12px monospace';
		ctx.textAlign = 'center';

		for (const m of respawnMarkers) {
			const markerWorldId = normalizeWorldId(m.world || '');
			if (currentWorldId && markerWorldId !== currentWorldId) continue;

			const sx = m.x * zoom + offsetX * zoom + width / 2;
			const sz = m.z * zoom + offsetZ * zoom + height / 2;

			ctx.fillStyle = '#a78bfa';
			ctx.fillText('🛏', sx, sz);
		}

		ctx.restore();
	}

	function drawRegions(ctx, width, height) {
		if (!layers.regions || regionData.length === 0) return;

		const currentWorldId = normalizeWorldId(selectedWorld);
		ctx.save();
		ctx.lineWidth = 2;
		ctx.font = '11px monospace';

		for (const r of regionData) {
			const regionWorldId = normalizeWorldId(r.world || '');
			if (currentWorldId && regionWorldId !== currentWorldId) continue;

			const sx1 = r.minX * zoom + offsetX * zoom + width / 2;
			const sz1 = r.minZ * zoom + offsetZ * zoom + height / 2;
			const sx2 = r.maxX * zoom + offsetX * zoom + width / 2;
			const sz2 = r.maxZ * zoom + offsetZ * zoom + height / 2;

			const rx = Math.min(sx1, sx2);
			const rz = Math.min(sz1, sz2);
			const rw = Math.abs(sx2 - sx1);
			const rh = Math.abs(sz2 - sz1);

			// Fill
			ctx.globalAlpha = 0.12;
			ctx.fillStyle = r.color || '#3388ff';
			ctx.fillRect(rx, rz, rw, rh);

			// Border
			ctx.globalAlpha = 0.7;
			ctx.strokeStyle = r.color || '#3388ff';
			ctx.strokeRect(rx, rz, rw, rh);

			// Label
			if (rw > 40 && rh > 20) {
				ctx.globalAlpha = 1;
				ctx.fillStyle = r.color || '#3388ff';
				ctx.fillText(r.name || '', rx + rw / 2, rz + rh / 2 + 4);
			}
		}

		ctx.globalAlpha = 1;
		ctx.restore();
	}

	function drawHeatmap(ctx, width, height) {
		if (!layers.heatmap || heatmapData.length === 0) return;

		const CHUNK_PX = 16 * zoom;
		if (CHUNK_PX < 2) return;

		// Find max count for normalisation
		const maxCount = Math.max(...heatmapData.map((c) => c.count), 1);

		ctx.save();

		for (const chunk of heatmapData) {
			const currentWorldId = normalizeWorldId(selectedWorld);
			const chunkWorldId = normalizeWorldId(chunk.world || selectedWorld);
			if (currentWorldId && chunkWorldId !== currentWorldId) continue;

			const sx = chunk.cx * 16 * zoom + offsetX * zoom + width / 2;
			const sz = chunk.cz * 16 * zoom + offsetZ * zoom + height / 2;

			const intensity = Math.min(1, chunk.count / maxCount);
			const alpha = intensity * 0.55;

			// Red (high entity count) → yellow (medium) → transparent (low)
			const r = 255;
			const g = Math.round(255 * (1 - intensity));
			const b = 0;

			ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
			ctx.fillRect(sx, sz, CHUNK_PX, CHUNK_PX);
		}

		ctx.restore();
	}

	function drawBlockGrid(ctx, width, height) {
		const gridSize = 16 * zoom;
		if (gridSize <= BLOCK_GRID_MIN_PX) return;

		const startX = (((offsetX * zoom + width / 2) % gridSize) + gridSize) % gridSize;
		const startZ = (((offsetZ * zoom + height / 2) % gridSize) + gridSize) % gridSize;

		ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = startX; x < width; x += gridSize) {
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
		}
		for (let z = startZ; z < height; z += gridSize) {
			ctx.moveTo(0, z);
			ctx.lineTo(width, z);
		}
		ctx.stroke();
	}

	function drawChunkGrid(ctx, width, height) {
		const chunkGridSize = 16 * 16 * zoom;
		if (chunkGridSize <= CHUNK_GRID_MIN_PX) return;

		const chunkStartX =
			(((offsetX * zoom + width / 2) % chunkGridSize) + chunkGridSize) % chunkGridSize;
		const chunkStartZ =
			(((offsetZ * zoom + height / 2) % chunkGridSize) + chunkGridSize) % chunkGridSize;

		ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = chunkStartX; x < width; x += chunkGridSize) {
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
		}
		for (let z = chunkStartZ; z < height; z += chunkGridSize) {
			ctx.moveTo(0, z);
			ctx.lineTo(width, z);
		}
		ctx.stroke();
	}

	function drawSpawnMarker(ctx, width, height) {
		if (!metadata?.worlds) return;

		const world = metadata.worlds.find((w) => w.id === selectedWorld);
		if (!world) return;

		const sx = world.spawn.x * zoom + offsetX * zoom + width / 2;
		const sz = world.spawn.z * zoom + offsetZ * zoom + height / 2;

		ctx.strokeStyle = '#f59e0b';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(sx - 8, sz - 8);
		ctx.lineTo(sx + 8, sz + 8);
		ctx.moveTo(sx + 8, sz - 8);
		ctx.lineTo(sx - 8, sz + 8);
		ctx.stroke();

		ctx.fillStyle = '#f59e0b';
		ctx.font = '11px monospace';
		ctx.fillText('Spawn', sx + 12, sz + 4);
	}

	function drawOriginCrosshair(ctx, width, height) {
		const ox = offsetX * zoom + width / 2;
		const oz = offsetZ * zoom + height / 2;
		ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(ox, 0);
		ctx.lineTo(ox, height);
		ctx.moveTo(0, oz);
		ctx.lineTo(width, oz);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawPlayers(ctx, width, height) {
		const currentWorldId = normalizeWorldId(selectedWorld);

		for (const player of players) {
			const playerWorldId = normalizeWorldId(player.world || '');
			if (currentWorldId && playerWorldId !== currentWorldId) continue;

			const px = player.x * zoom + offsetX * zoom + width / 2;
			const pz = player.z * zoom + offsetZ * zoom + height / 2;

			ctx.fillStyle = '#22d3ee';
			ctx.beginPath();
			ctx.arc(px, pz, PLAYER_DOT_RADIUS, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = '#e2e8f0';
			ctx.font = '10px monospace';
			ctx.fillText(player.name, px + 8, pz + 3);
		}
	}

	function drawCoordinatesHUD(ctx, width, height) {
		ctx.fillStyle = 'rgba(30, 25, 45, 0.85)';
		ctx.fillRect(8, height - 32, 220, 24);
		ctx.fillStyle = '#c4b5fd';
		ctx.font = '12px monospace';
		ctx.fillText(
			`X: ${mouseWorldX.toFixed(0)}  Z: ${mouseWorldZ.toFixed(0)}  Zoom: ${zoom.toFixed(2)}x`,
			14,
			height - 14
		);
	}

	// -------------------------------------------------------------------------
	// Main render function
	// -------------------------------------------------------------------------

	function renderCanvas() {
		if (!canvasEl) return;
		if (document.hidden) return;

		const ctx = canvasEl.getContext('2d');
		const { width, height } = canvasEl;
		if (width === 0 || height === 0) return;

		ctx.fillStyle = '#1a1625';
		ctx.fillRect(0, 0, width, height);

		drawTiles(ctx, width, height);
		drawHeatmap(ctx, width, height);
		drawRegions(ctx, width, height);
		drawTrails(ctx, width, height);
		drawDeathMarkers(ctx, width, height);
		drawRespawnMarkers(ctx, width, height);
		drawBlockGrid(ctx, width, height);
		drawChunkGrid(ctx, width, height);
		drawSpawnMarker(ctx, width, height);
		drawOriginCrosshair(ctx, width, height);
		drawPlayers(ctx, width, height);
		drawCoordinatesHUD(ctx, width, height);
	}

	// -------------------------------------------------------------------------
	// Data loading
	// -------------------------------------------------------------------------

	async function loadMetadata() {
		try {
			const result = await mapMetadata();
			metadata = result;
			mapServerOnline = true;
			if (result.worlds?.length > 0 && !selectedWorld) {
				selectedWorld = result.worlds[0].id;
				const world = result.worlds[0];
				offsetX = -world.spawn.x;
				offsetZ = -world.spawn.z;
			}
		} catch {
			mapServerOnline = false;
			if (!metadata) {
				metadata = DEFAULT_METADATA;
				selectedWorld = DEFAULT_METADATA.worlds[0].id;
			}
		}
	}

	async function loadPlayers() {
		try {
			const result = await mapPlayers();
			players = result.players || [];
		} catch {
			// silently ignore — players overlay is best-effort
		}
	}

	async function loadLayerData() {
		if (!selectedWorld) return;

		const world = selectedWorld;
		const tasks = [];

		if (layers.trails || layers.deaths || layers.respawns) {
			tasks.push(
				fetch(`/api/map/markers?world=${encodeURIComponent(world)}`)
					.then((r) => r.json())
					.then((data) => {
						if (data.success) {
							deathMarkers = data.deaths || [];
							respawnMarkers = data.respawns || [];
						}
					})
					.catch(() => {})
			);
		}

		if (layers.trails) {
			tasks.push(
				fetch(`/api/map/trails?world=${encodeURIComponent(world)}&hours=24`)
					.then((r) => r.json())
					.then((data) => {
						if (data.success) trailData = data.trails || [];
					})
					.catch(() => {})
			);
		}

		if (layers.regions) {
			tasks.push(
				fetch(`/api/map/regions?world=${encodeURIComponent(world)}`)
					.then((r) => r.json())
					.then((data) => {
						if (data.success) regionData = data.regions || [];
					})
					.catch(() => {})
			);
		}

		if (layers.heatmap) {
			tasks.push(
				fetch(`/api/map/heatmap?world=${encodeURIComponent(world)}`)
					.then((r) => r.json())
					.then((data) => {
						if (data.success) heatmapData = data.heatmap || [];
					})
					.catch(() => {})
			);
		}

		await Promise.allSettled(tasks);
		scheduleRender();
	}

	// -------------------------------------------------------------------------
	// Region editor actions
	// -------------------------------------------------------------------------

	async function saveRegion(region) {
		const resp = await fetch('/api/map/regions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(region)
		});
		const data = await resp.json();
		if (!data.success) {
			throw new Error(data.error || 'Save failed');
		}
		showRegionEditor = false;
		await loadLayerData();
	}

	// -------------------------------------------------------------------------
	// Canvas click — marker hit-test
	// -------------------------------------------------------------------------

	function handleCanvasClick(e) {
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cz = e.clientY - rect.top;

		const worldX = (cx - canvasEl.width / 2) / zoom - offsetX;
		const worldZ = (cz - canvasEl.height / 2) / zoom - offsetZ;

		const CLICK_RADIUS = 12 / zoom;

		// Check death markers
		if (layers.deaths) {
			for (const m of deathMarkers) {
				const dist = Math.sqrt((m.x - worldX) ** 2 + (m.z - worldZ) ** 2);
				if (dist < CLICK_RADIUS) {
					activeMarker = { ...m, type: 'death' };
					return;
				}
			}
		}

		// Check respawn markers
		if (layers.respawns) {
			for (const m of respawnMarkers) {
				const dist = Math.sqrt((m.x - worldX) ** 2 + (m.z - worldZ) ** 2);
				if (dist < CLICK_RADIUS) {
					activeMarker = { ...m, type: 'respawn' };
					return;
				}
			}
		}

		activeMarker = null;
	}

	// -------------------------------------------------------------------------
	// Player locate
	// -------------------------------------------------------------------------

	function locatePlayer(player) {
		offsetX = -player.x;
		offsetZ = -player.z;
		scheduleRender();
	}

	// -------------------------------------------------------------------------
	// Effects
	// -------------------------------------------------------------------------

	$effect(() => {
		loadMetadata();
		const playerInterval = setInterval(loadPlayers, 5000);
		const metadataInterval = setInterval(loadMetadata, 30_000);
		return () => {
			clearInterval(playerInterval);
			clearInterval(metadataInterval);
		};
	});

	// Reload layer data when world changes or any layer is toggled on
	$effect(() => {
		void selectedWorld;
		void layers.trails;
		void layers.deaths;
		void layers.respawns;
		void layers.regions;
		void layers.heatmap;
		loadLayerData();
	});

	// Refresh heatmap every 15s if enabled
	$effect(() => {
		if (!layers.heatmap) return;
		const interval = setInterval(loadLayerData, 15_000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (canvasEl) {
			handleResize();
			canvasEl.addEventListener('wheel', handleWheel, { passive: false });
			return () => canvasEl.removeEventListener('wheel', handleWheel);
		}
	});

	$effect(() => {
		void selectedWorld;
		for (const entry of tileCache.values()) {
			entry.img.onload = null;
			entry.img.onerror = null;
		}
		tileCache.clear();
		scheduleRender();
	});

	$effect(() => {
		void offsetX;
		void offsetZ;
		void zoom;
		void selectedWorld;
		void mapServerOnline;
		void metadata;
		void players;
		void mouseWorldX;
		void mouseWorldZ;
		void layers;
		void trailData;
		void deathMarkers;
		void respawnMarkers;
		void regionData;
		void heatmapData;
		scheduleRender();
	});

	$effect(() => {
		return () => {
			cancelAnimationFrame(animFrameId);
			for (const entry of tileCache.values()) {
				entry.img.onload = null;
				entry.img.onerror = null;
			}
			tileCache.clear();
		};
	});

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	function handleResize() {
		if (canvasEl) {
			const rect = canvasEl.parentElement.getBoundingClientRect();
			canvasEl.width = rect.width;
			canvasEl.height = rect.height;
			scheduleRender();
		}
	}

	function handleMouseDown(e) {
		isDragging = true;
		dragStartX = e.clientX - offsetX * zoom;
		dragStartZ = e.clientY - offsetZ * zoom;
	}

	function handleMouseMove(e) {
		const rect = canvasEl.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cz = e.clientY - rect.top;

		mouseWorldX = (cx - canvasEl.width / 2) / zoom - offsetX;
		mouseWorldZ = (cz - canvasEl.height / 2) / zoom - offsetZ;

		if (isDragging) {
			offsetX = (e.clientX - dragStartX) / zoom;
			offsetZ = (e.clientY - dragStartZ) / zoom;
		}
	}

	function handleMouseUp(e) {
		if (isDragging) {
			const dx = Math.abs(e.clientX - (dragStartX + offsetX * zoom));
			const dz = Math.abs(e.clientY - (dragStartZ + offsetZ * zoom));
			// Only fire click if the mouse didn't move much (not a drag)
			if (dx < 5 && dz < 5) {
				handleCanvasClick(e);
			}
		}
		isDragging = false;
	}

	function handleWheel(e) {
		e.preventDefault();
		const rect = canvasEl.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const mz = e.clientY - rect.top;

		const factor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
		const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));

		const dx = mx - canvasEl.width / 2;
		const dz = mz - canvasEl.height / 2;
		offsetX = offsetX + dx * (1 / newZoom - 1 / zoom);
		offsetZ = offsetZ + dz * (1 / newZoom - 1 / zoom);
		zoom = newZoom;
	}

	function centerOnSpawn() {
		if (metadata?.worlds) {
			const world = metadata.worlds.find((w) => w.id === selectedWorld);
			if (world) {
				offsetX = -world.spawn.x;
				offsetZ = -world.spawn.z;
			}
		}
	}

	function centerOnOrigin() {
		offsetX = 0;
		offsetZ = 0;
	}
</script>

<svelte:window onresize={handleResize} />

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-6 py-4 border-b border-obsidian-700">
		<div>
			<h2 class="text-xl font-bold text-purple-400">World Map</h2>
			<p class="text-sm text-obsidian-200 mt-0.5">
				Live server map — {players.length} player{players.length !== 1 ? 's' : ''} online
			</p>
		</div>
		<div class="flex items-center gap-3">
			{#if metadata?.worlds}
				<select
					class="bg-obsidian-800 border border-obsidian-600 text-obsidian-100 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
					bind:value={selectedWorld}
				>
					{#each metadata.worlds as world}
						<option value={world.id}>{world.name}</option>
					{/each}
				</select>
			{/if}
			<button
				onclick={() => (showRegionEditor = !showRegionEditor)}
				class="px-3 py-1.5 text-sm bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded hover:bg-purple-600/30 transition-colors"
			>
				+ Region
			</button>
			<button
				onclick={centerOnSpawn}
				class="px-3 py-1.5 text-sm bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded hover:bg-amber-600/30 transition-colors"
			>
				Spawn
			</button>
			<button
				onclick={centerOnOrigin}
				class="px-3 py-1.5 text-sm bg-obsidian-700 text-obsidian-200 border border-obsidian-600 rounded hover:bg-obsidian-600 transition-colors"
			>
				Origin
			</button>
		</div>
	</div>

	<!-- Map area -->
	<MapContainer bind:canvasEl onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
		<!-- Layer controls (bottom-left of map) -->
		<MapLayerControls {layers} onToggle={toggleLayer} />

		<!-- Player sidebar -->
		<MapPlayerSidebar {players} onLocate={locatePlayer} />

		<!-- Marker popup -->
		<MapMarkerPopup marker={activeMarker} onClose={() => (activeMarker = null)} />

		<!-- Region editor (admin) -->
		{#if showRegionEditor}
			<MapRegionEditor
				world={selectedWorld}
				onSave={saveRegion}
				onCancel={() => (showRegionEditor = false)}
			/>
		{/if}
	</MapContainer>
</div>
