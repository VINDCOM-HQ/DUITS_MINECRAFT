<script>
	import { getStatus } from '$lib/api.js';
	import { setAgentOnline, getRcon, getSmb, getMysql } from '$lib/stores/connections.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	let status = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');

	async function fetchStatus() {
		try {
			const result = await getStatus();
			status = result;
			setAgentOnline(true);
			errorMsg = '';
		} catch (err) {
			setAgentOnline(false);
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
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${h}h ${m}m ${s}s`;
	}

	function formatMemory(bytes) {
		if (!bytes) return '\u2014';
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">Dashboard</h1>

	{#if loading}
		<div class="text-gray-400">Loading agent status...</div>
	{:else if errorMsg}
		<div class="bg-rose-600/20 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-lg mb-6">
			Agent unreachable: {errorMsg}
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Agent Status</h3>
			<div class="flex items-center gap-3">
				<StatusIndicator status={status ? 'connected' : 'disconnected'} />
				<span class="text-lg font-semibold">{status ? 'Online' : 'Offline'}</span>
			</div>
			{#if status}
				<p class="text-xs text-gray-500 mt-2">v{status.version || '?'} &middot; {status.platform || '?'}</p>
			{/if}
		</div>

		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Uptime</h3>
			<span class="text-lg font-semibold">{formatUptime(status?.uptime)}</span>
		</div>

		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Memory</h3>
			<span class="text-lg font-semibold">{formatMemory(status?.memory?.rss)}</span>
			<p class="text-xs text-gray-500 mt-1">Heap: {formatMemory(status?.memory?.heapUsed)}</p>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Connections</h3>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<StatusIndicator status={getRcon().connected ? 'connected' : 'disconnected'} label="RCON" />
					{#if getRcon().connected}
						<span class="text-xs text-gray-500">{getRcon().host}:{getRcon().port}</span>
					{/if}
				</div>
				<div class="flex items-center justify-between">
					<StatusIndicator status={getSmb().connected ? 'connected' : 'disconnected'} label="Storage" />
					{#if getSmb().connected}
						<span class="text-xs text-gray-500">{getSmb().host}</span>
					{/if}
				</div>
				<div class="flex items-center justify-between">
					<StatusIndicator status={getMysql().connected ? 'connected' : 'disconnected'} label="Database" />
					{#if getMysql().connected}
						<span class="text-xs text-gray-500">{getMysql().host}:{getMysql().port}</span>
					{/if}
				</div>
			</div>
		</div>

		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Quick Links</h3>
			<div class="space-y-2">
				<a href="/console" class="block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Open RCON Console</a>
				<a href="/players" class="block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Manage Players</a>
				<a href="/files" class="block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Browse Server Files</a>
				<a href="/database" class="block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Database Queries</a>
			</div>
		</div>
	</div>

	{#if status?.clients}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Active Agent Clients</h3>
			<div class="grid grid-cols-3 gap-4 text-center">
				<div>
					<span class="text-2xl font-bold text-indigo-400">{status.clients.rcon?.length || 0}</span>
					<p class="text-xs text-gray-500">RCON</p>
				</div>
				<div>
					<span class="text-2xl font-bold text-emerald-500">{status.clients.smb?.length || 0}</span>
					<p class="text-xs text-gray-500">SMB</p>
				</div>
				<div>
					<span class="text-2xl font-bold text-amber-500">{status.clients.mysql?.length || 0}</span>
					<p class="text-xs text-gray-500">MySQL</p>
				</div>
			</div>
		</div>
	{/if}
</div>
