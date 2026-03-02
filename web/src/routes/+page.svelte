<script>
	import { getStatus, loginAttemptsSummary } from '$lib/api.js';
	import { setRcon, setMysql, getServerStatus, setServerStatus } from '$lib/stores/connections.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';
	import { page } from '$app/stores';

	let status = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');

	async function fetchStatus() {
		try {
			const result = await getStatus();
			status = result;
			errorMsg = '';

			// Update shared connection stores from status API
			if (result.server) {
				setServerStatus(result.server.status || 'unknown');
			}
			if (result.rcon) {
				setRcon({ connected: result.rcon.connected, host: result.rcon.host || '', port: result.rcon.port || 25575 });
			}
			if (result.mysql) {
				setMysql({
					connected: result.mysql.connected,
					host: result.mysql.host || '',
					port: result.mysql.port || 3306,
					database: result.mysql.gameDb || ''
				});
			}
		} catch (err) {
			errorMsg = err.message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, 15000);
		return () => clearInterval(interval);
	});

	function formatUptime(seconds) {
		if (!seconds) return '\u2014';
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (d > 0) return `${d}d ${h}h ${m}m`;
		return `${h}h ${m}m ${s}s`;
	}

	function formatSupervisorUptime(uptimeStr) {
		if (!uptimeStr) return '\u2014';
		const match = uptimeStr.match(/(\d+):(\d+):(\d+)/);
		if (!match) return uptimeStr;
		const totalH = parseInt(match[1]);
		const m = parseInt(match[2]);
		const s = parseInt(match[3]);
		if (totalH >= 24) {
			const d = Math.floor(totalH / 24);
			const h = totalH % 24;
			return `${d}d ${h}h ${m}m`;
		}
		return `${totalH}h ${m}m ${s}s`;
	}

	function formatBytes(bytes) {
		if (!bytes) return '\u2014';
		if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
		return `${(bytes / 1048576).toFixed(0)} MB`;
	}

	function stripMotdCodes(text) {
		if (!text) return '';
		return text.replace(/\u00A7[0-9a-fk-or]/gi, '').replace(/\\u00A7[0-9a-fk-or]/gi, '');
	}

	function capitalize(str) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	const serverState = $derived(getServerStatus());

	const serverStatusLabel = $derived(
		serverState === 'running' ? 'Running' :
		serverState === 'stopped' ? 'Stopped' :
		serverState === 'starting' ? 'Starting' :
		serverState === 'error' ? 'Error' : 'Unknown'
	);

	const heroBorderColor = $derived(
		serverState === 'running' ? 'border-emerald-500/50' :
		serverState === 'stopped' ? 'border-rose-500/50' :
		serverState === 'starting' ? 'border-amber-500/50' : 'border-obsidian-500'
	);

	const heroStatusColor = $derived(
		serverState === 'running' ? 'text-emerald-400' :
		serverState === 'stopped' ? 'text-rose-400' :
		serverState === 'starting' ? 'text-amber-400' : 'text-obsidian-300'
	);

	const statusDotColor = $derived(
		serverState === 'running' ? 'bg-emerald-500' :
		serverState === 'stopped' ? 'bg-rose-500' :
		serverState === 'starting' ? 'bg-amber-500 animate-pulse' : 'bg-obsidian-500'
	);

	// Filesystem data (server.properties + plugins/)
	const game = $derived(status?.game || { plugins: [], query: { available: false, players: { online: 0, max: 0, list: [] } } });

	// Query protocol data (live server metadata)
	const query = $derived(game.query || { available: false, players: { online: 0, max: 0, list: [] } });

	const playerMax = $derived(game.maxPlayers || query.players?.max || 0);

	const playerPercent = $derived.by(() => {
		if (!playerMax) return 0;
		return Math.round((query.players.online / playerMax) * 100);
	});

	const ramUsed = $derived.by(() => {
		if (!status?.systemMemory?.total || !status?.systemMemory?.free) return 0;
		return status.systemMemory.total - status.systemMemory.free;
	});

	const ramPercent = $derived.by(() => {
		if (!status?.systemMemory?.total) return 0;
		return Math.round((ramUsed / status.systemMemory.total) * 100);
	});

	const cpuCount = $derived(status?.cpus?.count || 0);
	const cpuLoad = $derived(status?.cpus?.load?.avg1 ?? 0);
	const cpuLoadAvailable = $derived(
		(status?.cpus?.load?.avg1 ?? 0) !== 0 ||
		(status?.cpus?.load?.avg5 ?? 0) !== 0 ||
		(status?.cpus?.load?.avg15 ?? 0) !== 0
	);
	const cpuPercent = $derived.by(() => {
		if (!cpuCount || !cpuLoadAvailable) return 0;
		return Math.min(100, Math.round((cpuLoad / cpuCount) * 100));
	});

	// Security: failed login attempts (admin only)
	const isAdmin = $derived($page.data?.user?.role === 'admin');
	let loginSecurity = $state(null);

	$effect(() => {
		if (!isAdmin) return;

		async function fetchSecurity() {
			try {
				loginSecurity = await loginAttemptsSummary();
			} catch {
				// Non-critical — silently ignore
			}
		}

		fetchSecurity();
		const interval = setInterval(fetchSecurity, 30000);
		return () => clearInterval(interval);
	});

	function timeAgo(dateStr) {
		if (!dateStr) return '';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	const quickActions = [
		{ href: '/console', label: 'Console', icon: 'M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z' },
		{ href: '/players', label: 'Players', icon: 'M7 8a3 3 0 100-6 3 3 0 000 6zm7.5 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z' },
		{ href: '/files', label: 'Files', icon: 'M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z' },
		{ href: '/database', label: 'Database', icon: 'M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3zM3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7zM17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z' },
		{ href: '/server', label: 'Server', icon: 'M4.632 3.533A2 2 0 016.577 2h6.846a2 2 0 011.945 1.533l1.976 8.234A3.489 3.489 0 0016 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234z' },
		{ href: '/query', label: 'Query', icon: 'M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389z' }
	];
</script>

<div class="w-full">
	{#if loading}
		<div class="text-obsidian-200">Loading status...</div>
	{:else if errorMsg}
		<div class="bg-rose-600/20 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-lg mb-6">
			Status unavailable: {errorMsg}
		</div>
	{/if}

	<!-- Hero Banner -->
	<div class="card border-l-4 {heroBorderColor} mb-6">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="w-3.5 h-3.5 rounded-full shrink-0 {statusDotColor}"></span>
				<div>
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-xl font-bold {heroStatusColor}">{serverStatusLabel}</span>
						{#if query.software || query.version}
							<span class="text-sm text-obsidian-300">
								{query.software}{query.version ? ` ${query.version}` : ''}
							</span>
						{/if}
					</div>
					{#if game.motd}
						<p class="text-sm text-obsidian-200 mt-0.5 italic">{stripMotdCodes(game.motd)}</p>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-4 text-xs text-obsidian-300 flex-wrap">
				{#if game.map}
					<span class="flex items-center gap-1.5">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
							<path fill-rule="evenodd" d="M5.37 2.257a1.25 1.25 0 0 1 1.214-.054l3.378 1.69 2.133-1.313A1.25 1.25 0 0 1 14 3.644v8.421a1.25 1.25 0 0 1-.597 1.066l-2.932 1.804a1.25 1.25 0 0 1-1.214.054L5.88 13.3l-2.133 1.313A1.25 1.25 0 0 1 1.75 13.55V5.13a1.25 1.25 0 0 1 .597-1.066L5.37 2.257Z" clip-rule="evenodd"/>
						</svg>
						{game.map}
					</span>
				{/if}
				{#if game.difficulty}
					<span>{capitalize(game.difficulty)}</span>
				{/if}
				{#if game.gameMode}
					<span>{capitalize(game.gameMode)}</span>
				{/if}
				<span class="font-medium text-obsidian-200">{query.players.online}/{playerMax} players</span>
				{#if status?.server?.uptime}
					<span>Up {formatSupervisorUptime(status.server.uptime)}</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Stat Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<!-- Players -->
		<div class="card card-hover">
			<h3 class="text-xs font-medium text-obsidian-300 uppercase tracking-wide mb-2">Players</h3>
			<div class="flex items-baseline gap-1.5 mb-2">
				<span class="text-2xl font-bold text-obsidian-100">{query.players?.online ?? 0}</span>
				<span class="text-sm text-obsidian-300">/ {playerMax || '?'}</span>
			</div>
			<div class="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
				<div
					class="h-full rounded-full transition-all duration-500 bg-purple-500"
					style="width: {playerPercent}%"
				></div>
			</div>
		</div>

		<!-- System RAM -->
		<div class="card card-hover">
			<div class="flex items-center justify-between mb-2">
				<h3 class="text-xs font-medium text-obsidian-300 uppercase tracking-wide">System RAM</h3>
				<span class="text-xs text-obsidian-300">{ramPercent}%</span>
			</div>
			<div class="flex items-baseline gap-1.5 mb-2">
				<span class="text-2xl font-bold text-obsidian-100">{formatBytes(ramUsed)}</span>
				<span class="text-sm text-obsidian-300">/ {formatBytes(status?.systemMemory?.total)}</span>
			</div>
			<div class="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
				<div
					class="h-full rounded-full transition-all duration-500 {ramPercent > 85 ? 'bg-rose-500' : ramPercent > 65 ? 'bg-amber-500' : 'bg-emerald-500'}"
					style="width: {ramPercent}%"
				></div>
			</div>
		</div>

		<!-- Server Uptime -->
		<div class="card card-hover">
			<h3 class="text-xs font-medium text-obsidian-300 uppercase tracking-wide mb-2">Server Uptime</h3>
			<div class="text-2xl font-bold text-obsidian-100">
				{#if status?.server?.uptime}
					{formatSupervisorUptime(status.server.uptime)}
				{:else if serverState === 'running'}
					Starting...
				{:else if serverState === 'stopped'}
					Offline
				{:else}
					{formatUptime(status?.systemUptime)}
				{/if}
			</div>
			<p class="text-xs text-obsidian-300 mt-1">
				{#if status?.server?.uptime}
					Container: {formatUptime(status?.systemUptime)}
				{:else if serverState === 'unknown'}
					No supervisor — showing container uptime
				{/if}
			</p>
		</div>

		<!-- CPU -->
		<div class="card card-hover">
			<div class="flex items-center justify-between mb-2">
				<h3 class="text-xs font-medium text-obsidian-300 uppercase tracking-wide">CPU</h3>
				{#if cpuLoadAvailable}
					<span class="text-xs text-obsidian-300">{cpuPercent}%</span>
				{/if}
			</div>
			<div class="flex items-baseline gap-1.5 mb-2">
				{#if cpuLoadAvailable}
					<span class="text-2xl font-bold text-obsidian-100">{cpuLoad.toFixed(1)}</span>
					<span class="text-sm text-obsidian-300">/ {cpuCount} cores</span>
				{:else}
					<span class="text-2xl font-bold text-obsidian-100">{cpuCount}</span>
					<span class="text-sm text-obsidian-300">cores</span>
				{/if}
			</div>
			{#if cpuLoadAvailable}
				<div class="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-500 {cpuPercent > 85 ? 'bg-rose-500' : cpuPercent > 65 ? 'bg-amber-500' : 'bg-emerald-500'}"
						style="width: {cpuPercent}%"
					></div>
				</div>
			{:else}
				<p class="text-xs text-obsidian-400">Load avg unavailable on Windows</p>
			{/if}
		</div>
	</div>

	<!-- Middle Row: Players + Services -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
		<!-- Online Players (from Query protocol) -->
		<div class="card">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-sm font-medium text-obsidian-200">Online Players</h3>
				{#if query.available}
					<span class="text-xs text-obsidian-300">{query.players.online} online</span>
				{/if}
			</div>
			{#if !query.available}
				<div class="text-center py-6">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8 text-obsidian-500 mx-auto mb-2">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/>
					</svg>
					{#if serverState !== 'running'}
						<p class="text-sm text-obsidian-300">Server not running</p>
						<p class="text-xs text-obsidian-400 mt-1">Start the server to see online players</p>
					{:else}
						<p class="text-sm text-obsidian-300">Query protocol unavailable</p>
						<p class="text-xs text-obsidian-400 mt-1">Enable <code class="bg-obsidian-700 px-1.5 py-0.5 rounded text-obsidian-200">enable-query=true</code> in server.properties</p>
					{/if}
				</div>
			{:else if query.players.list.length === 0}
				<div class="text-center py-6">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8 text-obsidian-500 mx-auto mb-2">
						<path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7.5 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z"/>
					</svg>
					<p class="text-sm text-obsidian-300">No players online</p>
				</div>
			{:else}
				<div class="space-y-1.5 max-h-52 overflow-y-auto">
					{#each query.players.list as player}
						<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-obsidian-700/40">
							<img
								src="https://mc-heads.net/avatar/{player}/24"
								alt={player}
								class="w-6 h-6 rounded"
								onerror={(e) => { e.target.style.display = 'none'; }}
							/>
							<span class="text-sm text-obsidian-100">{player}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Services -->
		<div class="card">
			<h3 class="text-sm font-medium text-obsidian-200 mb-4">Services</h3>
			<div class="space-y-3">
				<div class="flex items-center justify-between py-2 border-b border-obsidian-700/60">
					<div class="flex items-center gap-3">
						<StatusIndicator status={status?.rcon?.connected ? 'connected' : 'disconnected'} />
						<span class="text-sm text-obsidian-100">RCON</span>
					</div>
					<span class="text-xs text-obsidian-300">
						{status?.rcon?.connected ? `${status.rcon.host}:${status.rcon.port}` : 'Disconnected'}
					</span>
				</div>
				<div class="flex items-center justify-between py-2 border-b border-obsidian-700/60">
					<div class="flex items-center gap-3">
						<StatusIndicator status={query.available ? 'connected' : 'disconnected'} />
						<span class="text-sm text-obsidian-100">Query</span>
					</div>
					<span class="text-xs text-obsidian-300">
						{query.available ? `Port ${game.serverPort || 25565}` : serverState !== 'running' ? 'Server offline' : game.enableQuery ? 'Not responding' : 'Disabled in config'}
					</span>
				</div>
				<div class="flex items-center justify-between py-2 border-b border-obsidian-700/60">
					<div class="flex items-center gap-3">
						<StatusIndicator status={status?.mysql?.connected ? 'connected' : 'disconnected'} />
						<span class="text-sm text-obsidian-100">MySQL</span>
					</div>
					<span class="text-xs text-obsidian-300">
						{status?.mysql?.connected ? `${status.mysql.host}:${status.mysql.port}` : 'Disconnected'}
					</span>
				</div>
				<div class="flex items-center justify-between py-2">
					<div class="flex items-center gap-3">
						<StatusIndicator status="connected" />
						<span class="text-sm text-obsidian-100">Filesystem</span>
					</div>
					<span class="text-xs text-obsidian-300">Direct access</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom Row: Quick Actions + Game Info + Container Info + Security -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<!-- Quick Actions -->
		<div class="card">
			<h3 class="text-sm font-medium text-obsidian-200 mb-4">Quick Actions</h3>
			<div class="grid grid-cols-3 gap-2">
				{#each quickActions as action}
					<a
						href={action.href}
						class="flex flex-col items-center gap-2 py-3 px-2 rounded-lg bg-obsidian-700/50 hover:bg-purple-500/10 hover:text-purple-400 text-obsidian-200 transition-colors text-center"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
							<path fill-rule="evenodd" d={action.icon} clip-rule="evenodd"/>
						</svg>
						<span class="text-xs">{action.label}</span>
					</a>
				{/each}
			</div>
		</div>

		<!-- Game Info (Query protocol when available, server.properties fallback) -->
		<div class="card">
			<h3 class="text-sm font-medium text-obsidian-200 mb-4">Game Info</h3>
			<div class="space-y-3 text-sm">
				{#if query.software || query.version}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Software</span>
						<span class="text-obsidian-100">{query.software || '?'} {query.version || ''}</span>
					</div>
				{/if}
				{#if query.map || game.map}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Map</span>
						<span class="text-obsidian-100">{query.map || game.map}</span>
					</div>
				{/if}
				{#if query.gameType || game.gameMode}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Game Type</span>
						<span class="text-obsidian-100">{query.available ? query.gameType : capitalize(game.gameMode)}</span>
					</div>
				{/if}
				{#if game.difficulty}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Difficulty</span>
						<span class="text-obsidian-100">{capitalize(game.difficulty)}</span>
					</div>
				{/if}
				<div class="flex justify-between">
					<span class="text-obsidian-300">PvP</span>
					<span class="text-obsidian-100">{game.pvp ? 'Enabled' : 'Disabled'}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-obsidian-300">View Distance</span>
					<span class="text-obsidian-100">{game.viewDistance || '?'} chunks</span>
				</div>
				{#if query.available && query.queryPlugins?.length}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Plugins</span>
						<span class="text-obsidian-100">{query.queryPlugins.length} loaded</span>
					</div>
				{:else if game.plugins?.length}
					<div class="flex justify-between">
						<span class="text-obsidian-300">Plugins</span>
						<span class="text-obsidian-100">{game.plugins.length} installed</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Container Info -->
		<div class="card">
			<h3 class="text-sm font-medium text-obsidian-200 mb-4">Container Info</h3>
			<div class="space-y-3 text-sm">
				<div class="flex justify-between">
					<span class="text-obsidian-300">Hostname</span>
					<span class="text-obsidian-100 font-mono text-xs">{status?.hostname || '\u2014'}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-obsidian-300">Platform</span>
					<span class="text-obsidian-100">{status?.platform || '?'} ({status?.arch || '?'})</span>
				</div>
				<div class="flex justify-between">
					<span class="text-obsidian-300">CPUs</span>
					<span class="text-obsidian-100">{status?.cpus?.count || '?'}&times; {status?.cpus?.model || 'Unknown'}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-obsidian-300">Total RAM</span>
					<span class="text-obsidian-100">{formatBytes(status?.systemMemory?.total)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-obsidian-300">Container Uptime</span>
					<span class="text-obsidian-100">{formatUptime(status?.systemUptime)}</span>
				</div>
			</div>
		</div>

		<!-- Security: Failed Login Attempts (admin only) -->
		{#if isAdmin}
			<div class="card">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-sm font-medium text-obsidian-200">Failed Logins</h3>
					{#if loginSecurity?.total24h > 0}
						<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-600/20 text-rose-400">
							{loginSecurity.total24h} in 24h
						</span>
					{:else}
						<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
							Clear
						</span>
					{/if}
				</div>

				{#if !loginSecurity}
					<p class="text-xs text-obsidian-400">Loading...</p>
				{:else if loginSecurity.total24h === 0}
					<div class="text-center py-4">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8 text-emerald-500/50 mx-auto mb-2">
							<path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd"/>
						</svg>
						<p class="text-sm text-obsidian-300">No failed attempts</p>
						<p class="text-xs text-obsidian-400 mt-1">Last 24 hours</p>
					</div>
				{:else}
					<div class="space-y-3 text-sm mb-3">
						<div class="flex justify-between">
							<span class="text-obsidian-300">Unique IPs</span>
							<span class="text-obsidian-100">{loginSecurity.uniqueIps24h}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-obsidian-300">Unique Usernames</span>
							<span class="text-obsidian-100">{loginSecurity.uniqueUsernames24h}</span>
						</div>
					</div>

					{#if loginSecurity.recentAttempts?.length > 0}
						<div class="border-t border-obsidian-700/60 pt-3">
							<p class="text-xs text-obsidian-300 mb-2">Recent attempts</p>
							<div class="space-y-1.5">
								{#each loginSecurity.recentAttempts as attempt}
									<div class="flex items-center justify-between px-2 py-1.5 rounded bg-obsidian-700/40 text-xs">
										<div class="flex items-center gap-2 min-w-0">
											<span class="shrink-0 w-1.5 h-1.5 rounded-full {attempt.reason === 'account_locked' ? 'bg-amber-500' : 'bg-rose-500'}"></span>
											<span class="text-obsidian-100 truncate">{attempt.username}</span>
										</div>
										<div class="flex items-center gap-2 shrink-0 ml-2">
											<span class="text-obsidian-400 font-mono">{attempt.ip_address}</span>
											<span class="text-obsidian-400">{timeAgo(attempt.created_at)}</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>
