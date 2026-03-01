<script>
	import { getStatus } from '$lib/api.js';
	import { getAgentOnline } from '$lib/stores/connections.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';
	import { success as toastSuccess, error as toastError } from '$lib/stores/toast.svelte.js';

	let agentStatus = $state(null);

	async function refreshAgent() {
		try {
			agentStatus = await getStatus();
		} catch (err) {
			agentStatus = null;
		}
	}

	$effect(() => {
		refreshAgent();
	});

	// Saved connection profiles
	let rconServers = $state(JSON.parse(localStorage.getItem('rcon_servers') || '[]'));
	let smbConnections = $state(JSON.parse(localStorage.getItem('smb_connections') || '[]'));
	let mysqlConnections = $state(JSON.parse(localStorage.getItem('mysql_connections') || '[]'));

	function deleteProfile(type, index) {
		if (!confirm('Delete this profile?')) return;
		switch (type) {
			case 'rcon':
				rconServers = rconServers.filter((_, i) => i !== index);
				localStorage.setItem('rcon_servers', JSON.stringify(rconServers));
				break;
			case 'smb':
				smbConnections = smbConnections.filter((_, i) => i !== index);
				localStorage.setItem('smb_connections', JSON.stringify(smbConnections));
				break;
			case 'mysql':
				mysqlConnections = mysqlConnections.filter((_, i) => i !== index);
				localStorage.setItem('mysql_connections', JSON.stringify(mysqlConnections));
				break;
		}
		toastSuccess('Profile deleted');
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">Settings</h1>

	<!-- Agent Info -->
	<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-sm font-medium text-gray-400">Agent Relay</h2>
			<StatusIndicator status={getAgentOnline() ? 'connected' : 'disconnected'} label={getAgentOnline() ? 'Connected' : 'Disconnected'} />
		</div>

		{#if agentStatus}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
				<div>
					<span class="text-gray-500">Version</span>
					<p class="text-gray-200">{agentStatus.version || '?'}</p>
				</div>
				<div>
					<span class="text-gray-500">Platform</span>
					<p class="text-gray-200">{agentStatus.platform || '?'}</p>
				</div>
				<div>
					<span class="text-gray-500">Node.js</span>
					<p class="text-gray-200">{agentStatus.nodejs || '?'}</p>
				</div>
				<div>
					<span class="text-gray-500">Architecture</span>
					<p class="text-gray-200">{agentStatus.arch || '?'}</p>
				</div>
			</div>
		{:else}
			<p class="text-gray-500 text-sm italic">Agent not reachable</p>
		{/if}
	</div>

	<!-- Saved Profiles -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<!-- RCON Servers -->
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h2 class="text-sm font-medium text-gray-400 mb-3">RCON Servers ({rconServers.length})</h2>
			{#if rconServers.length === 0}
				<p class="text-gray-500 text-xs italic">No saved servers</p>
			{:else}
				<div class="space-y-2">
					{#each rconServers as server, i}
						<div class="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
							<div>
								<p class="text-sm text-gray-200">{server.name}</p>
								<p class="text-xs text-gray-500">{server.host}:{server.port}</p>
							</div>
							<button onclick={() => deleteProfile('rcon', i)} class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- SMB Connections -->
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h2 class="text-sm font-medium text-gray-400 mb-3">SMB Connections ({smbConnections.length})</h2>
			{#if smbConnections.length === 0}
				<p class="text-gray-500 text-xs italic">No saved connections</p>
			{:else}
				<div class="space-y-2">
					{#each smbConnections as conn, i}
						<div class="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
							<div>
								<p class="text-sm text-gray-200">{conn.name || conn.host}</p>
								<p class="text-xs text-gray-500">{conn.host}/{conn.share}</p>
							</div>
							<button onclick={() => deleteProfile('smb', i)} class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- MySQL Connections -->
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h2 class="text-sm font-medium text-gray-400 mb-3">MySQL Connections ({mysqlConnections.length})</h2>
			{#if mysqlConnections.length === 0}
				<p class="text-gray-500 text-xs italic">No saved connections</p>
			{:else}
				<div class="space-y-2">
					{#each mysqlConnections as conn, i}
						<div class="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
							<div>
								<p class="text-sm text-gray-200">{conn.name || conn.database}</p>
								<p class="text-xs text-gray-500">{conn.host}:{conn.port}/{conn.database}</p>
							</div>
							<button onclick={() => deleteProfile('mysql', i)} class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
