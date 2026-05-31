<script>
	import { queryServer } from '$lib/api.js';
	import { error as toastError } from '$lib/stores/toast.svelte.js';

	let mode = $state('full');
	let bypassCache = $state(false);
	let result = $state(null);
	let loading = $state(false);

	async function runQuery() {
		loading = true;
		result = null;
		try {
			const res = await queryServer(mode, bypassCache);
			result = res.info || res;
		} catch (err) {
			toastError(err.message);
		} finally {
			loading = false;
		}
	}

	// Auto-query on mount
	$effect(() => {
		runQuery();
	});
</script>

<div class="w-full">
	<h1 class="text-2xl font-bold text-obsidian-100 mb-6">Server Query</h1>

	<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
		<div class="flex items-center gap-4 flex-wrap">
			<select
				bind:value={mode}
				class="px-3 py-2 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm"
			>
				<option value="basic">Basic</option>
				<option value="full">Full</option>
			</select>

			<button
				onclick={runQuery}
				disabled={loading}
				class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg transition-colors"
			>
				{loading ? 'Querying...' : 'Refresh'}
			</button>

			<label class="flex items-center gap-2 text-sm text-obsidian-200">
				<input type="checkbox" bind:checked={bypassCache} class="rounded" />
				Bypass cache
			</label>
		</div>
	</div>

	{#if loading}
		<div class="card text-center py-8">
			<p class="text-obsidian-300">Querying server...</p>
		</div>
	{:else if result}
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5">
			<h2 class="text-sm font-medium text-obsidian-200 mb-4">Query Results</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each Object.entries(result) as [key, value]}
					{#if key !== 'success'}
						<div class="bg-obsidian-800 rounded-lg px-4 py-3">
							<span class="text-xs text-obsidian-300 uppercase tracking-wide">{key}</span>
							<div class="text-obsidian-100 mt-1 text-sm">
								{#if Array.isArray(value)}
									{value.length > 0 ? value.join(', ') : 'None'}
								{:else if typeof value === 'object' && value !== null}
									<pre class="text-xs overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
								{:else}
									{value}
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
