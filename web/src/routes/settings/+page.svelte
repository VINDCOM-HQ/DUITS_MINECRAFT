<script>
	import { getStatus } from '$lib/api.js';

	let status = $state(null);
	let loading = $state(true);

	$effect(() => {
		loadStatus();
	});

	async function loadStatus() {
		try {
			status = await getStatus();
		} catch {
			status = null;
		} finally {
			loading = false;
		}
	}

	const config = $derived(status?.config || {});
	const authMethod = $derived.by(() => {
		if (config.auth?.oauthEnabled) return 'OAuth / OIDC';
		if (config.auth?.samlEnabled) return 'SAML';
		return 'Local';
	});
</script>

<div class="w-full">
	<h1 class="text-2xl font-bold text-obsidian-100 mb-6">Settings</h1>

	{#if loading}
		<div class="card text-center py-8">
			<p class="text-obsidian-300">Loading configuration...</p>
		</div>
	{:else if !status}
		<div class="card text-center py-8">
			<p class="text-obsidian-300">Unable to load system status</p>
		</div>
	{:else}
		<p class="text-xs text-obsidian-400 mb-4">Resolved configuration from container environment variables. Change these in your Docker Compose or environment file.</p>

		<!-- RCON -->
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
			<h2 class="text-sm font-medium text-obsidian-200 mb-3">RCON</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_RCON_HOST</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.rcon?.host || 'localhost'}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_RCON_PORT</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.rcon?.port || 25575}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_RCON_PASSWORD</span>
					<p class="font-mono text-xs mt-0.5 {config.rcon?.passwordSet ? 'text-emerald-400' : 'text-rose-400'}">
						{config.rcon?.passwordSet ? '********' : 'Not set'}
					</p>
				</div>
			</div>
		</div>

		<!-- MySQL -->
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
			<h2 class="text-sm font-medium text-obsidian-200 mb-3">MySQL</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_DB_HOST</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.mysql?.host || 'localhost'}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_DB_PORT</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.mysql?.port || 3306}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_DB_USER</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.mysql?.user || 'netherdeck'}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_DB_PASSWORD</span>
					<p class="font-mono text-xs mt-0.5 {config.mysql?.passwordSet ? 'text-emerald-400' : 'text-rose-400'}">
						{config.mysql?.passwordSet ? '********' : 'Not set'}
					</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_DB_NAME</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.mysql?.portalDb || 'netherdeck'}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_GAME_DB_NAME</span>
					<p class="font-mono text-xs mt-0.5 {config.mysql?.gameDbConfigured ? 'text-obsidian-100' : 'text-obsidian-400'}">
						{config.mysql?.gameDbConfigured ? config.mysql?.gameDb : 'Not set'}
					</p>
				</div>
			</div>
		</div>

		<!-- Query & Filesystem -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Query Protocol</h2>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div>
						<span class="text-obsidian-400 text-xs">WEB_PORTAL_RCON_HOST</span>
						<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.query?.host || 'localhost'}</p>
					</div>
					<div>
						<span class="text-obsidian-400 text-xs">WEB_PORTAL_QUERY_PORT</span>
						<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.query?.port || 25565}</p>
					</div>
				</div>
			</div>

			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
				<h2 class="text-sm font-medium text-obsidian-200 mb-3">Filesystem</h2>
				<div class="text-sm">
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_MC_DIR</span>
					<p class="text-obsidian-100 font-mono text-xs mt-0.5">{config.filesystem?.mcDir || '/minecraft'}</p>
				</div>
			</div>
		</div>

		<!-- Authentication -->
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
			<h2 class="text-sm font-medium text-obsidian-200 mb-3">Authentication</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
				<div>
					<span class="text-obsidian-400 text-xs">Auth Method</span>
					<p class="text-obsidian-100 text-xs mt-0.5">{authMethod}</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_ADMIN_USER</span>
					<p class="font-mono text-xs mt-0.5 {config.auth?.adminUserSet ? 'text-emerald-400' : 'text-obsidian-400'}">
						{config.auth?.adminUserSet ? 'Set' : 'Not set (auto-generated)'}
					</p>
				</div>
				<div>
					<span class="text-obsidian-400 text-xs">WEB_PORTAL_SESSION_SECRET</span>
					<p class="font-mono text-xs mt-0.5 {config.auth?.sessionSecretSet ? 'text-emerald-400' : 'text-amber-400'}">
						{config.auth?.sessionSecretSet ? 'Set' : 'Auto-generated'}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
