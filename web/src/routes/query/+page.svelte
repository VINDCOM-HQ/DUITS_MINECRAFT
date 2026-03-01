<script>
	import { queryServer } from '$lib/api.js';
	import { error as toastError } from '$lib/stores/toast.svelte.js';

	let host = $state('localhost');
	let port = $state(25565);
	let mode = $state('basic');
	let bypassCache = $state(false);
	let result = $state(null);
	let loading = $state(false);

	async function runQuery() {
		loading = true;
		result = null;
		try {
			const res = await queryServer(host, port, mode, bypassCache);
			result = res.info || res;
		} catch (err) {
			toastError(err.message);
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">Server Query</h1>

	<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
			<input
				type="text"
				bind:value={host}
				placeholder="Host"
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500"
			/>
			<input
				type="number"
				bind:value={port}
				placeholder="Port"
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500"
			/>
			<select
				bind:value={mode}
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm"
			>
				<option value="basic">Basic</option>
				<option value="full">Full</option>
			</select>
		</div>

		<div class="flex items-center gap-4">
			<button
				onclick={runQuery}
				disabled={loading || !host}
				class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
			>
				{loading ? 'Querying...' : 'Query Server'}
			</button>
			<label class="flex items-center gap-2 text-sm text-gray-400">
				<input type="checkbox" bind:checked={bypassCache} class="rounded" />
				Bypass cache
			</label>
		</div>
	</div>

	{#if result}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
			<h2 class="text-sm font-medium text-gray-400 mb-4">Query Results</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each Object.entries(result) as [key, value]}
					<div class="bg-slate-800 rounded-lg px-4 py-3">
						<span class="text-xs text-gray-500 uppercase tracking-wide">{key}</span>
						<div class="text-gray-100 mt-1 text-sm">
							{#if Array.isArray(value)}
								{value.length > 0 ? value.join(', ') : 'None'}
							{:else if typeof value === 'object' && value !== null}
								<pre class="text-xs overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
							{:else}
								{value}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
