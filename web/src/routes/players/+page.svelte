<script>
	import { rconCommand } from '$lib/api.js';
	import { getRcon } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import Modal from '$lib/components/Modal.svelte';

	let players = $state([]);
	let selectedPlayer = $state('');
	let loading = $state(false);
	let confirmAction = $state(null);
	let confirmOpen = $state(false);
	let banReason = $state('');

	// Coordinates
	let playerCoords = $state(null);
	let coordsLoading = $state(false);

	// Teleport
	let tpOpen = $state(false);
	let tpX = $state('');
	let tpY = $state('');
	let tpZ = $state('');
	let tpTarget = $state('');

	const gameModes = ['survival', 'creative', 'adventure', 'spectator'];
	const modeColors = {
		survival: 'bg-emerald-600 hover:bg-emerald-500',
		creative: 'bg-purple-600 hover:bg-purple-500',
		adventure: 'bg-amber-600 hover:bg-amber-500',
		spectator: 'bg-obsidian-600 hover:bg-obsidian-500'
	};

	async function fetchPlayers() {
		if (!getRcon().connected) return;
		loading = true;
		try {
			const result = await rconCommand('list');
			const response = result.response || '';
			const match = response.match(/There are (\d+) of a max of \d+ players online:(.*)/);
			if (match) {
				const names = match[2].trim();
				players = names ? names.split(',').map((n) => n.trim()).filter(Boolean) : [];
			} else {
				players = [];
			}
		} catch (err) {
			toastError('Failed to fetch players');
		} finally {
			loading = false;
		}
	}

	async function fetchCoords(player) {
		if (!getRcon().connected || !player) return;
		coordsLoading = true;
		try {
			const result = await rconCommand(`data get entity ${player} Pos`);
			const response = result.response || '';
			const nums = response.match(/-?\d+\.?\d*/g);
			if (nums && nums.length >= 3) {
				playerCoords = {
					x: parseFloat(nums[0]).toFixed(1),
					y: parseFloat(nums[1]).toFixed(1),
					z: parseFloat(nums[2]).toFixed(1)
				};
			} else {
				playerCoords = null;
			}
		} catch {
			playerCoords = null;
		} finally {
			coordsLoading = false;
		}
	}

	function selectPlayer(player) {
		selectedPlayer = player;
		playerCoords = null;
		fetchCoords(player);
	}

	$effect(() => {
		if (getRcon().connected) {
			fetchPlayers();
			const interval = setInterval(fetchPlayers, 10000);
			return () => clearInterval(interval);
		}
	});

	// Auto-refresh coordinates for selected player
	$effect(() => {
		if (getRcon().connected && selectedPlayer) {
			const interval = setInterval(() => fetchCoords(selectedPlayer), 5000);
			return () => clearInterval(interval);
		}
	});

	async function runCommand(cmd) {
		try {
			await rconCommand(cmd);
			toastSuccess(`Executed: ${cmd}`);
			setTimeout(fetchPlayers, 1000);
		} catch (err) {
			toastError(err.message);
		}
	}

	function setGameMode(mode) {
		if (!selectedPlayer) return;
		runCommand(`gamemode ${mode} ${selectedPlayer}`);
	}

	function showConfirm(action) {
		confirmAction = action;
		banReason = '';
		confirmOpen = true;
	}

	function openTeleport() {
		tpX = playerCoords?.x ?? '';
		tpY = playerCoords?.y ?? '';
		tpZ = playerCoords?.z ?? '';
		tpTarget = '';
		tpOpen = true;
	}

	function executeTeleport() {
		if (!selectedPlayer) return;
		if (tpTarget) {
			runCommand(`tp ${selectedPlayer} ${tpTarget}`);
		} else if (tpX !== '' && tpY !== '' && tpZ !== '') {
			runCommand(`tp ${selectedPlayer} ${tpX} ${tpY} ${tpZ}`);
		} else {
			toastError('Enter coordinates or a target player');
			return;
		}
		tpOpen = false;
	}

	function executeConfirm() {
		if (!selectedPlayer || !confirmAction) return;
		const reason = banReason ? ` ${banReason}` : '';
		switch (confirmAction) {
			case 'ban': runCommand(`ban ${selectedPlayer}${reason}`); break;
			case 'kick': runCommand(`kick ${selectedPlayer}${reason}`); break;
			case 'ban-ip': runCommand(`ban-ip ${selectedPlayer}${reason}`); break;
			case 'op': runCommand(`op ${selectedPlayer}`); break;
			case 'deop': runCommand(`deop ${selectedPlayer}`); break;
		}
		confirmOpen = false;
	}
</script>

<div class="w-full">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-obsidian-100">Player Management</h1>
		<span class="text-sm text-obsidian-200">
			{players.length} player{players.length !== 1 ? 's' : ''} online
		</span>
	</div>

	{#if !getRcon().connected}
		<div class="bg-amber-600/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg">
			Connect to a server via RCON first.
			<a href="/console" class="underline hover:text-amber-200">Go to Console</a>
		</div>
	{:else}
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-medium text-obsidian-200">Online Players</h2>
				<button
					onclick={fetchPlayers}
					disabled={loading}
					class="text-xs text-purple-400 hover:text-purple-300 transition-colors"
				>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>

			{#if players.length === 0}
				<p class="text-obsidian-300 text-sm italic">No players online</p>
			{:else}
				<div class="flex flex-wrap gap-2 mb-4">
					{#each players as player}
						<button
							onclick={() => selectPlayer(player)}
							class="px-3 py-1.5 rounded-lg text-sm transition-colors {selectedPlayer === player
								? 'bg-purple-600 text-white'
								: 'bg-obsidian-800 text-obsidian-200 hover:bg-obsidian-700'}"
						>
							{player}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if selectedPlayer}
			<!-- Coordinates -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-medium text-obsidian-200">Position</h3>
					<button
						onclick={() => fetchCoords(selectedPlayer)}
						disabled={coordsLoading}
						class="text-xs text-purple-400 hover:text-purple-300 transition-colors"
					>
						{coordsLoading ? 'Loading...' : 'Refresh'}
					</button>
				</div>
				{#if playerCoords}
					<div class="flex items-center gap-6">
						<div class="flex items-center gap-2">
							<span class="text-xs text-obsidian-400 uppercase font-medium w-4">X</span>
							<span class="text-lg font-mono text-obsidian-100">{playerCoords.x}</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-xs text-obsidian-400 uppercase font-medium w-4">Y</span>
							<span class="text-lg font-mono text-obsidian-100">{playerCoords.y}</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-xs text-obsidian-400 uppercase font-medium w-4">Z</span>
							<span class="text-lg font-mono text-obsidian-100">{playerCoords.z}</span>
						</div>
						<button
							onclick={openTeleport}
							class="ml-auto px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
						>
							Teleport
						</button>
					</div>
				{:else if coordsLoading}
					<p class="text-obsidian-300 text-sm italic">Fetching coordinates...</p>
				{:else}
					<div class="flex items-center justify-between">
						<p class="text-obsidian-300 text-sm italic">Coordinates unavailable</p>
						<button
							onclick={openTeleport}
							class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
						>
							Teleport
						</button>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
					<h3 class="text-sm font-medium text-obsidian-200 mb-3">Game Mode</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each gameModes as mode}
							<button
								onclick={() => setGameMode(mode)}
								class="px-3 py-2 text-sm text-white rounded-lg transition-colors capitalize {modeColors[mode]}"
							>
								{mode}
							</button>
						{/each}
					</div>
				</div>

				<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
					<h3 class="text-sm font-medium text-obsidian-200 mb-3">Moderation</h3>
					<div class="grid grid-cols-2 gap-2">
						<button onclick={() => showConfirm('kick')} class="px-3 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors">Kick</button>
						<button onclick={() => showConfirm('ban')} class="px-3 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors">Ban</button>
						<button onclick={() => showConfirm('ban-ip')} class="px-3 py-2 text-sm bg-rose-700 hover:bg-rose-600 text-white rounded-lg transition-colors">Ban IP</button>
						<button onclick={() => showConfirm('op')} class="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">Op</button>
						<button onclick={() => showConfirm('deop')} class="px-3 py-2 text-sm bg-obsidian-600 hover:bg-obsidian-500 text-white rounded-lg transition-colors">Deop</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<Modal open={confirmOpen} title="Confirm Action" onclose={() => { confirmOpen = false; }}>
	{#snippet children()}
		<p class="text-obsidian-200 mb-4">
			{confirmAction} <strong class="text-purple-400">{selectedPlayer}</strong>?
		</p>
		{#if confirmAction === 'ban' || confirmAction === 'kick' || confirmAction === 'ban-ip'}
			<input
				type="text"
				bind:value={banReason}
				placeholder="Reason (optional)"
				class="w-full px-3 py-2 bg-obsidian-700 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm mb-4"
			/>
		{/if}
		<div class="flex gap-2 justify-end">
			<button onclick={() => { confirmOpen = false; }} class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg">Cancel</button>
			<button onclick={executeConfirm} class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg">Confirm</button>
		</div>
	{/snippet}
</Modal>

<Modal open={tpOpen} title="Teleport Player" onclose={() => { tpOpen = false; }}>
	{#snippet children()}
		<p class="text-obsidian-200 mb-4">
			Teleport <strong class="text-purple-400">{selectedPlayer}</strong> to:
		</p>

		<!-- Teleport to coordinates -->
		<div class="mb-4">
			<label class="text-xs text-obsidian-300 uppercase font-medium mb-2 block">Coordinates</label>
			<div class="grid grid-cols-3 gap-2">
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-obsidian-400 font-medium">X</span>
					<input
						type="number"
						bind:value={tpX}
						placeholder="0"
						class="w-full pl-8 pr-3 py-2 bg-obsidian-700 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm font-mono"
					/>
				</div>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-obsidian-400 font-medium">Y</span>
					<input
						type="number"
						bind:value={tpY}
						placeholder="64"
						class="w-full pl-8 pr-3 py-2 bg-obsidian-700 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm font-mono"
					/>
				</div>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-obsidian-400 font-medium">Z</span>
					<input
						type="number"
						bind:value={tpZ}
						placeholder="0"
						class="w-full pl-8 pr-3 py-2 bg-obsidian-700 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm font-mono"
					/>
				</div>
			</div>
		</div>

		<!-- Divider -->
		<div class="flex items-center gap-3 mb-4">
			<div class="flex-1 border-t border-obsidian-600"></div>
			<span class="text-xs text-obsidian-400 uppercase">or</span>
			<div class="flex-1 border-t border-obsidian-600"></div>
		</div>

		<!-- Teleport to player -->
		<div class="mb-4">
			<label class="text-xs text-obsidian-300 uppercase font-medium mb-2 block">Target Player</label>
			{#if players.filter(p => p !== selectedPlayer).length > 0}
				<div class="flex flex-wrap gap-2">
					{#each players.filter(p => p !== selectedPlayer) as target}
						<button
							onclick={() => { tpTarget = target; tpX = ''; tpY = ''; tpZ = ''; }}
							class="px-3 py-1.5 rounded-lg text-sm transition-colors {tpTarget === target
								? 'bg-blue-600 text-white'
								: 'bg-obsidian-700 text-obsidian-200 hover:bg-obsidian-600'}"
						>
							{target}
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-obsidian-400 text-sm italic">No other players online</p>
			{/if}
		</div>

		<div class="flex gap-2 justify-end">
			<button onclick={() => { tpOpen = false; }} class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg">Cancel</button>
			<button onclick={executeTeleport} class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Teleport</button>
		</div>
	{/snippet}
</Modal>
