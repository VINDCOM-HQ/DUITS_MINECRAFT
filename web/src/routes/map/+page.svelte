<script>
	import { mapMetadata, mapPlayers, mapTileUrl } from '$lib/api.js';
	import { error as toastError } from '$lib/stores/toast.svelte.js';

	let metadata = $state(null);
	let players = $state([]);
	let loading = $state(true);
	let mapAvailable = $state(false);

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

	// Selected dimension
	let selectedWorld = $state('');

	const TILE_SIZE = 256;

	async function loadMetadata() {
		loading = true;
		try {
			const result = await mapMetadata();
			metadata = result;
			mapAvailable = true;
			if (result.worlds && result.worlds.length > 0) {
				selectedWorld = result.worlds[0].id;
				// Center on spawn
				const world = result.worlds[0];
				offsetX = -world.spawn.x;
				offsetZ = -world.spawn.z;
			}
		} catch {
			mapAvailable = false;
		} finally {
			loading = false;
		}
	}

	async function loadPlayers() {
		try {
			const result = await mapPlayers();
			players = result.players || [];
		} catch {
			// silently ignore
		}
	}

	$effect(() => {
		loadMetadata();
		const playerInterval = setInterval(loadPlayers, 5000);
		return () => clearInterval(playerInterval);
	});

	// Canvas rendering
	$effect(() => {
		if (!canvasEl || !mapAvailable) return;

		const ctx = canvasEl.getContext('2d');
		const width = canvasEl.width;
		const height = canvasEl.height;

		// Clear
		ctx.fillStyle = '#1a1625';
		ctx.fillRect(0, 0, width, height);

		// Draw grid
		const gridSize = 16 * zoom;
		const startX = ((offsetX * zoom + width / 2) % gridSize + gridSize) % gridSize;
		const startZ = ((offsetZ * zoom + height / 2) % gridSize + gridSize) % gridSize;

		ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
		ctx.lineWidth = 1;
		for (let x = startX; x < width; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}
		for (let z = startZ; z < height; z += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, z);
			ctx.lineTo(width, z);
			ctx.stroke();
		}

		// Draw chunk grid (thicker)
		const chunkGridSize = 16 * 16 * zoom;
		const chunkStartX = ((offsetX * zoom + width / 2) % chunkGridSize + chunkGridSize) % chunkGridSize;
		const chunkStartZ = ((offsetZ * zoom + height / 2) % chunkGridSize + chunkGridSize) % chunkGridSize;

		ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
		ctx.lineWidth = 1;
		for (let x = chunkStartX; x < width; x += chunkGridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}
		for (let z = chunkStartZ; z < height; z += chunkGridSize) {
			ctx.beginPath();
			ctx.moveTo(0, z);
			ctx.lineTo(width, z);
			ctx.stroke();
		}

		// Draw spawn marker
		if (metadata && metadata.worlds) {
			const world = metadata.worlds.find(w => w.id === selectedWorld);
			if (world) {
				const sx = world.spawn.x * zoom + offsetX * zoom + width / 2;
				const sz = world.spawn.z * zoom + offsetZ * zoom + height / 2;

				// Spawn cross
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
		}

		// Draw origin crosshair
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

		// Draw players
		for (const player of players) {
			const worldName = player.world || '';
			if (selectedWorld && !selectedWorld.includes(worldName.replace(':', '_'))) continue;

			const px = player.x * zoom + offsetX * zoom + width / 2;
			const pz = player.z * zoom + offsetZ * zoom + height / 2;

			// Player dot
			ctx.fillStyle = '#22d3ee';
			ctx.beginPath();
			ctx.arc(px, pz, 4, 0, Math.PI * 2);
			ctx.fill();

			// Player name
			ctx.fillStyle = '#e2e8f0';
			ctx.font = '10px monospace';
			ctx.fillText(player.name, px + 8, pz + 3);
		}

		// Coordinates readout
		ctx.fillStyle = 'rgba(30, 25, 45, 0.85)';
		ctx.fillRect(8, height - 32, 220, 24);
		ctx.fillStyle = '#c4b5fd';
		ctx.font = '12px monospace';
		ctx.fillText(`X: ${mouseWorldX.toFixed(0)}  Z: ${mouseWorldZ.toFixed(0)}  Zoom: ${zoom.toFixed(2)}x`, 14, height - 14);
	});

	function handleResize() {
		if (canvasEl) {
			const rect = canvasEl.parentElement.getBoundingClientRect();
			canvasEl.width = rect.width;
			canvasEl.height = rect.height;
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

	function handleMouseUp() {
		isDragging = false;
	}

	function handleWheel(e) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		const newZoom = Math.max(0.1, Math.min(10, zoom * factor));
		zoom = newZoom;
	}

	function centerOnSpawn() {
		if (metadata && metadata.worlds) {
			const world = metadata.worlds.find(w => w.id === selectedWorld);
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
	<div class="flex items-center justify-between px-6 py-4 border-b border-obsidian-700">
		<div>
			<h2 class="text-xl font-bold text-purple-400">World Map</h2>
			<p class="text-sm text-obsidian-200 mt-0.5">
				{#if mapAvailable}
					Live server map — {players.length} player{players.length !== 1 ? 's' : ''} online
				{:else}
					Map service unavailable
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-3">
			{#if metadata && metadata.worlds}
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

	<div class="flex-1 relative overflow-hidden bg-obsidian-950">
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center">
					<div class="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
					<p class="text-obsidian-200 text-sm">Loading map data...</p>
				</div>
			</div>
		{:else if !mapAvailable}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center max-w-md px-6">
					<div class="w-16 h-16 mx-auto mb-4 text-obsidian-500">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
							<path d="M15.5 2.25a.75.75 0 01.75-.75h5.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V4.06l-6.22 6.22a.75.75 0 11-1.06-1.06L19.94 3h-3.69a.75.75 0 01-.75-.75z"/>
							<path d="M2.25 4.5A2.25 2.25 0 014.5 2.25h5.25a.75.75 0 010 1.5H4.5a.75.75 0 00-.75.75v15a.75.75 0 00.75.75h15a.75.75 0 00.75-.75v-5.25a.75.75 0 011.5 0v5.25a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25v-15z"/>
						</svg>
					</div>
					<h3 class="text-lg font-semibold text-obsidian-100 mb-2">World Map Unavailable</h3>
					<p class="text-obsidian-300 text-sm">
						The world map service is not running. Enable it in
						<code class="text-purple-400 bg-obsidian-800 px-1 rounded">netherdeck.yml</code>
						by setting <code class="text-purple-400 bg-obsidian-800 px-1 rounded">world-map.enabled: true</code>
						and restart the server.
					</p>
				</div>
			</div>
		{:else}
			<canvas
				bind:this={canvasEl}
				class="w-full h-full cursor-grab active:cursor-grabbing"
				onmousedown={handleMouseDown}
				onmousemove={handleMouseMove}
				onmouseup={handleMouseUp}
				onmouseleave={handleMouseUp}
				onwheel={handleWheel}
			></canvas>

			<!-- Player list overlay -->
			{#if players.length > 0}
				<div class="absolute top-3 right-3 bg-obsidian-900/90 border border-obsidian-700 rounded-lg p-3 max-w-48">
					<h4 class="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider">Players</h4>
					<ul class="space-y-1">
						{#each players as player}
							<li class="flex items-center gap-2 text-xs">
								<span class="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
								<span class="text-obsidian-100 truncate">{player.name}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</div>
