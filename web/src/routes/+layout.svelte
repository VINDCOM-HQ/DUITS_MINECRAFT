<script>
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { data, children } = $props();
</script>

<Toast />

{#if data.authenticated}
	<div class="flex h-screen overflow-hidden">
		<Sidebar />
		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
