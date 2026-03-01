<script>
	import { mysqlConnect, mysqlQuery, mysqlDisconnect } from '$lib/api.js';
	import { getMysql, setMysql } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	let host = $state('localhost');
	let port = $state(3306);
	let user = $state('');
	let password = $state('');
	let database = $state('');
	let ssl = $state(false);
	let connecting = $state(false);

	let sql = $state('');
	let queryResult = $state(null);
	let queryColumns = $state([]);
	let executing = $state(false);

	async function connect() {
		connecting = true;
		try {
			const result = await mysqlConnect(host, port, user, password, database, ssl);
			setMysql({ clientId: result.clientId, connected: true, host, port, database });
			toastSuccess('MySQL connected');
		} catch (err) {
			toastError(err.message);
		} finally {
			connecting = false;
		}
	}

	async function disconnect() {
		try {
			await mysqlDisconnect(getMysql().clientId);
		} catch (_) {}
		setMysql({ clientId: null, connected: false, host: '', port: 3306, database: '' });
	}

	async function executeQuery() {
		if (!sql.trim() || !getMysql().clientId) return;
		executing = true;
		queryResult = null;
		queryColumns = [];
		try {
			const result = await mysqlQuery(getMysql().clientId, sql.trim());
			const rows = result.result || result.data || [];
			if (Array.isArray(rows) && rows.length > 0) {
				queryColumns = Object.keys(rows[0]);
				queryResult = rows;
			} else {
				queryResult = rows;
				queryColumns = [];
			}
			toastSuccess(`Query returned ${Array.isArray(rows) ? rows.length : 0} rows`);
		} catch (err) {
			toastError(err.message);
		} finally {
			executing = false;
		}
	}

	function handleKeydown(e) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			executeQuery();
		}
	}
</script>

<div class="max-w-5xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">Database</h1>

	{#if !getMysql().connected}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
			<h2 class="text-sm font-medium text-gray-400 mb-4">MySQL Connection</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
				<input type="text" bind:value={host} placeholder="Host" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="number" bind:value={port} placeholder="Port" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="text" bind:value={user} placeholder="Username" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="password" bind:value={password} placeholder="Password" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="text" bind:value={database} placeholder="Database" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<label class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
					<input type="checkbox" bind:checked={ssl} class="rounded" />
					SSL/TLS
				</label>
			</div>
			<button
				onclick={connect}
				disabled={connecting || !host || !user || !database}
				class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg"
			>
				{connecting ? 'Connecting...' : 'Connect'}
			</button>
		</div>
	{:else}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<StatusIndicator status="connected" label="{host}:{port}/{database}" />
				</div>
				<button onclick={disconnect} class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg">Disconnect</button>
			</div>

			<textarea
				bind:value={sql}
				onkeydown={handleKeydown}
				placeholder="Enter SQL query... (Ctrl+Enter to execute)"
				rows="4"
				class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm font-mono placeholder-gray-500 resize-y mb-3"
				spellcheck="false"
			></textarea>

			<button
				onclick={executeQuery}
				disabled={executing || !sql.trim()}
				class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg"
			>
				{executing ? 'Executing...' : 'Execute Query'}
			</button>
		</div>

		{#if queryResult !== null}
			<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
				<div class="px-4 py-3 border-b border-slate-800">
					<span class="text-sm text-gray-400">
						{Array.isArray(queryResult) ? `${queryResult.length} rows` : 'Query executed'}
					</span>
				</div>

				{#if queryColumns.length > 0}
					<div class="overflow-x-auto max-h-[50vh]">
						<table class="w-full text-sm">
							<thead class="bg-slate-800 sticky top-0">
								<tr>
									{#each queryColumns as col}
										<th class="text-left px-4 py-2 text-gray-400 font-medium whitespace-nowrap">{col}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each queryResult as row}
									<tr class="border-t border-slate-800 hover:bg-slate-800/50">
										{#each queryColumns as col}
											<td class="px-4 py-2 text-gray-300 whitespace-nowrap">{row[col] ?? 'NULL'}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="p-4">
						<pre class="text-sm text-gray-300 font-mono">{JSON.stringify(queryResult, null, 2)}</pre>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
