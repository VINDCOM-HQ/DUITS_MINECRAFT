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

	const gameModes = ['survival', 'creative', 'adventure', 'spectator'];
	const modeColors = {
		survival: 'bg-emerald-600 hover:bg-emerald-500',
		creative: 'bg-indigo-600 hover:bg-indigo-500',
		adventure: 'bg-amber-600 hover:bg-amber-500',
		spectator: 'bg-slate-600 hover:bg-slate-500'
	};

	async function fetchPlayers() {
		if (!getRcon().clientId) return;
		loading = true;
		try {
			const result = await rconCommand(getRcon().clientId, 'list');
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

	$effect(() => {
		if (getRcon().connected) {
			fetchPlayers();
			const interval = setInterval(fetchPlayers, 10000);
			return () => clearInterval(interval);
		}
	});

	async function runCommand(cmd) {
		try {
			await rconCommand(getRcon().clientId, cmd);
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

<div class="max-w-4xl">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-gray-100">Player Management</h1>
		<span class="text-sm text-gray-400">
			{players.length} player{players.length !== 1 ? 's' : ''} online
		</span>
	</div>

	{#if !getRcon().connected}
		<div class="bg-amber-600/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg">
			Connect to a server via RCON first.
			<a href="/console" class="underline hover:text-amber-200">Go to Console</a>
		</div>
	{:else}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-medium text-gray-400">Online Players</h2>
				<button
					onclick={fetchPlayers}
					disabled={loading}
					class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
				>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>

			{#if players.length === 0}
				<p class="text-gray-500 text-sm italic">No players online</p>
			{:else}
				<div class="flex flex-wrap gap-2 mb-4">
					{#each players as player}
						<button
							onclick={() => { selectedPlayer = player; }}
							class="px-3 py-1.5 rounded-lg text-sm transition-colors {selectedPlayer === player
								? 'bg-indigo-600 text-white'
								: 'bg-slate-800 text-gray-300 hover:bg-slate-700'}"
						>
							{player}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if selectedPlayer}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
					<h3 class="text-sm font-medium text-gray-400 mb-3">Game Mode</h3>
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

				<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
					<h3 class="text-sm font-medium text-gray-400 mb-3">Moderation</h3>
					<div class="grid grid-cols-2 gap-2">
						<button onclick={() => showConfirm('kick')} class="px-3 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors">Kick</button>
						<button onclick={() => showConfirm('ban')} class="px-3 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors">Ban</button>
						<button onclick={() => showConfirm('ban-ip')} class="px-3 py-2 text-sm bg-rose-700 hover:bg-rose-600 text-white rounded-lg transition-colors">Ban IP</button>
						<button onclick={() => showConfirm('op')} class="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">Op</button>
						<button onclick={() => showConfirm('deop')} class="px-3 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">Deop</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<Modal open={confirmOpen} title="Confirm Action" onclose={() => { confirmOpen = false; }}>
	{#snippet children()}
		<p class="text-gray-300 mb-4">
			{confirmAction} <strong class="text-indigo-400">{selectedPlayer}</strong>?
		</p>
		{#if confirmAction === 'ban' || confirmAction === 'kick' || confirmAction === 'ban-ip'}
			<input
				type="text"
				bind:value={banReason}
				placeholder="Reason (optional)"
				class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 text-sm mb-4"
			/>
		{/if}
		<div class="flex gap-2 justify-end">
			<button onclick={() => { confirmOpen = false; }} class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm rounded-lg">Cancel</button>
			<button onclick={executeConfirm} class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg">Confirm</button>
		</div>
	{/snippet}
</Modal>
