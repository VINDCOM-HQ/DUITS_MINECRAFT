<script>
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { data, children } = $props();
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
