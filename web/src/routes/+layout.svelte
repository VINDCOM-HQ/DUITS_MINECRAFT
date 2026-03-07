<script>
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { getStatus } from '$lib/api.js';
	import { setRcon, setMysql, setServerStatus } from '$lib/stores/connections.svelte.js';

	let { data, children } = $props();

	// Hydrate shared connection stores from /api/status so every page
	// (players, server, sidebar, etc.) has current state regardless of
	// which page the user navigates to first.
	$effect(() => {
		if (!data.user) return;

		async function hydrate() {
			try {
				const result = await getStatus();
				if (result.server) setServerStatus(result.server.status || 'unknown');
				if (result.rcon) setRcon({ connected: result.rcon.connected, host: result.rcon.host || '', port: result.rcon.port || 25575 });
				if (result.mysql) setMysql({ connected: result.mysql.connected, host: result.mysql.host || '', port: result.mysql.port || 3306, database: result.mysql.gameDb || '' });
			} catch {
				// Non-critical — individual pages will retry
			}
		}

		hydrate();
		const interval = setInterval(hydrate, 15000);
		return () => clearInterval(interval);
	});
</script>

<Toast />

{#if data.user}
	<div class="flex h-screen overflow-hidden bg-obsidian-950">
		<Sidebar user={data.user} />
		<main class="flex-1 overflow-y-auto p-6 bg-obsidian-950">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
