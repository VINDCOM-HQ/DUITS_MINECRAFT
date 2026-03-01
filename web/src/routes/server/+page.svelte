<script>
	import { rconCommand } from '$lib/api.js';
	import { getRcon } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';

	let bannedPlayers = $state([]);
	let bannedIPs = $state([]);
	let tickRate = $state(20);
	let idleTimeout = $state(0);
	let customTime = $state(6000);
	let loadingBans = $state(false);
	let loadingIPs = $state(false);

	const timePresets = [
		{ label: 'Dawn', value: 0 },
		{ label: 'Noon', value: 6000 },
		{ label: 'Sunset', value: 12000 },
		{ label: 'Midnight', value: 18000 }
	];

	const difficulties = ['peaceful', 'easy', 'normal', 'hard'];

	async function runCmd(cmd) {
		if (!getRcon().clientId) return null;
		try {
			const result = await rconCommand(getRcon().clientId, cmd);
			return result.response || '';
		} catch (err) {
			toastError(err.message);
			return null;
		}
	}

	async function fetchBannedPlayers() {
		loadingBans = true;
		const res = await runCmd('banlist players');
		if (res !== null) {
			const match = res.match(/There are \d+ ban\(s\):(.*)/);
			bannedPlayers = match ? match[1].split(',').map((n) => n.trim()).filter(Boolean) : [];
		}
		loadingBans = false;
	}

	async function fetchBannedIPs() {
		loadingIPs = true;
		const res = await runCmd('banlist ips');
		if (res !== null) {
			const match = res.match(/There are \d+ ban\(s\):(.*)/);
			bannedIPs = match ? match[1].split(',').map((n) => n.trim()).filter(Boolean) : [];
		}
		loadingIPs = false;
	}

	async function unban(name) {
		await runCmd(`pardon ${name}`);
		toastSuccess(`Unbanned ${name}`);
		fetchBannedPlayers();
	}

	async function unbanIP(ip) {
		await runCmd(`pardon-ip ${ip}`);
		toastSuccess(`Unbanned IP ${ip}`);
		fetchBannedIPs();
	}

	function setTime(value) { runCmd(`time set ${value}`); toastSuccess(`Time set to ${value}`); }
	function setWeather(w) { runCmd(`weather ${w}`); toastSuccess(`Weather: ${w}`); }
	function setDifficulty(d) { runCmd(`difficulty ${d}`); toastSuccess(`Difficulty: ${d}`); }
	function setTick() { runCmd(`tick rate ${tickRate}`); toastSuccess(`Tick rate: ${tickRate}`); }
	function setIdle() { runCmd(`setidletimeout ${idleTimeout}`); toastSuccess(`Idle timeout: ${idleTimeout}m`); }
	function saveWorld() { runCmd('save-all'); toastSuccess('World saved'); }
	function reloadServer() { runCmd('reload confirm'); toastSuccess('Server reloaded'); }

	$effect(() => {
		if (getRcon().connected) {
			fetchBannedPlayers();
			fetchBannedIPs();
		}
	});
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">Server Functions</h1>

	{#if !getRcon().connected}
		<div class="bg-amber-600/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg">
			Connect to a server via RCON first.
			<a href="/console" class="underline hover:text-amber-200">Go to Console</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
			<!-- Banned Players -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-medium text-gray-400">Banned Players ({bannedPlayers.length})</h2>
					<button onclick={fetchBannedPlayers} class="text-xs text-indigo-400 hover:text-indigo-300">{loadingBans ? '...' : 'Refresh'}</button>
				</div>
				{#if bannedPlayers.length === 0}
					<p class="text-gray-500 text-sm italic">No banned players</p>
				{:else}
					<div class="space-y-1 max-h-40 overflow-y-auto">
						{#each bannedPlayers as player}
							<div class="flex items-center justify-between px-2 py-1 bg-slate-800 rounded text-sm">
								<span class="text-gray-300">{player}</span>
								<button onclick={() => unban(player)} class="text-xs text-emerald-400 hover:text-emerald-300">Unban</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Banned IPs -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-medium text-gray-400">Banned IPs ({bannedIPs.length})</h2>
					<button onclick={fetchBannedIPs} class="text-xs text-indigo-400 hover:text-indigo-300">{loadingIPs ? '...' : 'Refresh'}</button>
				</div>
				{#if bannedIPs.length === 0}
					<p class="text-gray-500 text-sm italic">No banned IPs</p>
				{:else}
					<div class="space-y-1 max-h-40 overflow-y-auto">
						{#each bannedIPs as ip}
							<div class="flex items-center justify-between px-2 py-1 bg-slate-800 rounded text-sm">
								<span class="text-gray-300">{ip}</span>
								<button onclick={() => unbanIP(ip)} class="text-xs text-emerald-400 hover:text-emerald-300">Unban</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Controls -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
			<!-- Time -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<h2 class="text-sm font-medium text-gray-400 mb-3">Time of Day</h2>
				<div class="grid grid-cols-2 gap-2 mb-3">
					{#each timePresets as preset}
						<button onclick={() => setTime(preset.value)} class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-gray-300 rounded-lg transition-colors">{preset.label}</button>
					{/each}
				</div>
				<div class="flex gap-2">
					<input type="number" bind:value={customTime} min="0" max="24000" class="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm" />
					<button onclick={() => setTime(customTime)} class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg">Set</button>
				</div>
			</div>

			<!-- Weather -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<h2 class="text-sm font-medium text-gray-400 mb-3">Weather</h2>
				<div class="grid grid-cols-3 gap-2">
					<button onclick={() => setWeather('clear')} class="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg">Clear</button>
					<button onclick={() => setWeather('rain')} class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Rain</button>
					<button onclick={() => setWeather('thunder')} class="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg">Thunder</button>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Tick Rate -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<h2 class="text-sm font-medium text-gray-400 mb-3">Tick Rate</h2>
				<div class="flex gap-2">
					<input type="range" bind:value={tickRate} min="1" max="100" class="flex-1" />
					<span class="text-sm text-gray-300 w-8 text-right">{tickRate}</span>
					<button onclick={setTick} class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg">Set</button>
				</div>
			</div>

			<!-- Difficulty -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<h2 class="text-sm font-medium text-gray-400 mb-3">Difficulty</h2>
				<div class="grid grid-cols-2 gap-2">
					{#each difficulties as d}
						<button onclick={() => setDifficulty(d)} class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-gray-300 rounded-lg capitalize">{d}</button>
					{/each}
				</div>
			</div>

			<!-- Quick Commands -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
				<h2 class="text-sm font-medium text-gray-400 mb-3">Quick Commands</h2>
				<div class="space-y-2">
					<button onclick={saveWorld} class="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">Save World</button>
					<button onclick={reloadServer} class="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg">Reload</button>
				</div>
			</div>
		</div>
	{/if}
</div>
