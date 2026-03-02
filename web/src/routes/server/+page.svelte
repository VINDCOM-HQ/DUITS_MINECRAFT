<script>
	import { rconCommand, serverControl, serverStatus as fetchServerStatus } from '$lib/api.js';
	import { getRcon, getServerStatus, setServerStatus } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import Modal from '$lib/components/Modal.svelte';

	let bannedPlayers = $state([]);
	let bannedIPs = $state([]);
	let tickRate = $state(20);
	let idleTimeout = $state(0);
	let customTime = $state(6000);
	let loadingBans = $state(false);
	let loadingIPs = $state(false);
	let controlLoading = $state(false);
	let confirmAction = $state(null);
	let confirmOpen = $state(false);
	let serverUptime = $state(null);
	let serverPid = $state(null);

	const timePresets = [
		{ label: 'Dawn', value: 0 },
		{ label: 'Noon', value: 6000 },
		{ label: 'Sunset', value: 12000 },
		{ label: 'Midnight', value: 18000 }
	];

	const difficulties = ['peaceful', 'easy', 'normal', 'hard'];

	async function runCmd(cmd) {
		if (!getRcon().connected) return null;
		try {
			const result = await rconCommand(cmd);
			return result.response || '';
		} catch (err) {
			toastError(err.message);
			return null;
		}
	}

	async function refreshServerStatus() {
		try {
			const result = await fetchServerStatus();
			setServerStatus(result.status || 'unknown');
			serverUptime = result.uptime || null;
			serverPid = result.pid || null;
		} catch {
			setServerStatus('unknown');
		}
	}

	async function doServerControl(action) {
		controlLoading = true;
		try {
			await serverControl(action);
			toastSuccess(`Server ${action} initiated`);
			// Poll for status update
			setTimeout(refreshServerStatus, 2000);
			setTimeout(refreshServerStatus, 5000);
		} catch (err) {
			toastError(err.message);
		} finally {
			controlLoading = false;
		}
	}

	function showConfirmAction(action) {
		confirmAction = action;
		confirmOpen = true;
	}

	function executeConfirmAction() {
		if (!confirmAction) return;
		doServerControl(confirmAction);
		confirmOpen = false;
		confirmAction = null;
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
		refreshServerStatus();
		const interval = setInterval(refreshServerStatus, 10000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (getRcon().connected) {
			fetchBannedPlayers();
			fetchBannedIPs();
		}
	});

	const statusLabel = $derived(
		getServerStatus() === 'running' ? 'Running' :
		getServerStatus() === 'stopped' ? 'Stopped' :
		getServerStatus() === 'starting' ? 'Starting' :
		getServerStatus() === 'error' ? 'Error' : 'Unknown'
	);

	const statusColor = $derived(
		getServerStatus() === 'running' ? 'text-emerald-500' :
		getServerStatus() === 'stopped' ? 'text-rose-500' :
		getServerStatus() === 'starting' ? 'text-amber-500' : 'text-obsidian-200'
	);

	function formatUptime(str) {
		if (!str) return null;
		return str;
	}
</script>

<div class="w-full">
	<h1 class="text-2xl font-bold text-obsidian-100 mb-6">Server Control</h1>

	<!-- Process Control -->
	<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
		<h2 class="text-sm font-medium text-obsidian-200 mb-4">Minecraft Server Process</h2>
		<div class="flex items-center gap-4 mb-4">
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full {getServerStatus() === 'running' ? 'bg-emerald-500' : getServerStatus() === 'stopped' ? 'bg-rose-500' : getServerStatus() === 'starting' ? 'bg-amber-500 animate-pulse' : 'bg-gray-400'}"></div>
				<span class="text-lg font-semibold {statusColor}">{statusLabel}</span>
			</div>
			{#if serverUptime}
				<span class="text-sm text-obsidian-300">Uptime: {formatUptime(serverUptime)}</span>
			{/if}
			{#if serverPid}
				<span class="text-sm text-obsidian-300">PID: {serverPid}</span>
			{/if}
		</div>
		<div class="flex gap-2">
			{#if getServerStatus() === 'stopped'}
				<button
					onclick={() => doServerControl('start')}
					disabled={controlLoading}
					class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg transition-colors"
				>
					{controlLoading ? 'Starting...' : 'Start Server'}
				</button>
			{:else if getServerStatus() === 'running'}
				<button
					onclick={() => showConfirmAction('stop')}
					disabled={controlLoading}
					class="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg transition-colors"
				>
					Stop Server
				</button>
				<button
					onclick={() => showConfirmAction('restart')}
					disabled={controlLoading}
					class="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg transition-colors"
				>
					Restart Server
				</button>
			{:else}
				<button
					onclick={refreshServerStatus}
					class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg transition-colors"
				>
					Refresh Status
				</button>
			{/if}
		</div>
	</div>

	{#if !getRcon().connected}
		<div class="bg-amber-600/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg mb-4">
			Connect to a server via RCON to access game controls.
			<a href="/console" class="underline hover:text-amber-200">Go to Console</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
			<!-- Banned Players -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-medium text-obsidian-200">Banned Players ({bannedPlayers.length})</h2>
					<button onclick={fetchBannedPlayers} class="text-xs text-purple-400 hover:text-purple-300">{loadingBans ? '...' : 'Refresh'}</button>
				</div>
				{#if bannedPlayers.length === 0}
					<p class="text-obsidian-300 text-sm italic">No banned players</p>
				{:else}
					<div class="space-y-1 max-h-40 overflow-y-auto">
						{#each bannedPlayers as player}
							<div class="flex items-center justify-between px-2 py-1 bg-obsidian-800 rounded text-sm">
								<span class="text-obsidian-200">{player}</span>
								<button onclick={() => unban(player)} class="text-xs text-emerald-400 hover:text-emerald-300">Unban</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Banned IPs -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-medium text-obsidian-200">Banned IPs ({bannedIPs.length})</h2>
					<button onclick={fetchBannedIPs} class="text-xs text-purple-400 hover:text-purple-300">{loadingIPs ? '...' : 'Refresh'}</button>
				</div>
				{#if bannedIPs.length === 0}
					<p class="text-obsidian-300 text-sm italic">No banned IPs</p>
				{:else}
					<div class="space-y-1 max-h-40 overflow-y-auto">
						{#each bannedIPs as ip}
							<div class="flex items-center justify-between px-2 py-1 bg-obsidian-800 rounded text-sm">
								<span class="text-obsidian-200">{ip}</span>
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
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Time of Day</h2>
				<div class="grid grid-cols-2 gap-2 mb-3">
					{#each timePresets as preset}
						<button onclick={() => setTime(preset.value)} class="px-3 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-sm text-obsidian-200 rounded-lg transition-colors">{preset.label}</button>
					{/each}
				</div>
				<div class="flex gap-2">
					<input type="number" bind:value={customTime} min="0" max="24000" class="flex-1 px-3 py-2 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm" />
					<button onclick={() => setTime(customTime)} class="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg">Set</button>
				</div>
			</div>

			<!-- Weather -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Weather</h2>
				<div class="grid grid-cols-3 gap-2">
					<button onclick={() => setWeather('clear')} class="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg">Clear</button>
					<button onclick={() => setWeather('rain')} class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Rain</button>
					<button onclick={() => setWeather('thunder')} class="px-3 py-2 bg-obsidian-600 hover:bg-obsidian-500 text-white text-sm rounded-lg">Thunder</button>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Tick Rate -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Tick Rate</h2>
				<div class="flex gap-2">
					<input type="range" bind:value={tickRate} min="1" max="100" class="flex-1" />
					<span class="text-sm text-obsidian-200 w-8 text-right">{tickRate}</span>
					<button onclick={setTick} class="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg">Set</button>
				</div>
			</div>

			<!-- Difficulty -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Difficulty</h2>
				<div class="grid grid-cols-2 gap-2">
					{#each difficulties as d}
						<button onclick={() => setDifficulty(d)} class="px-3 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-sm text-obsidian-200 rounded-lg capitalize">{d}</button>
					{/each}
				</div>
			</div>

			<!-- Quick Commands -->
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Quick Commands</h2>
				<div class="space-y-2">
					<button onclick={saveWorld} class="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">Save World</button>
					<button onclick={reloadServer} class="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg">Reload</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<Modal open={confirmOpen} title="Confirm Server Action" onclose={() => { confirmOpen = false; }}>
	{#snippet children()}
		<p class="text-obsidian-200 mb-4">
			Are you sure you want to <strong class="text-amber-400">{confirmAction}</strong> the Minecraft server?
		</p>
		{#if confirmAction === 'stop'}
			<p class="text-sm text-obsidian-300 mb-4">This will disconnect all players currently on the server.</p>
		{/if}
		<div class="flex gap-2 justify-end">
			<button onclick={() => { confirmOpen = false; }} class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg">Cancel</button>
			<button onclick={executeConfirmAction} class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg">Confirm</button>
		</div>
	{/snippet}
</Modal>
