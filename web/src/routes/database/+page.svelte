<script>
	import { mysqlConnect, mysqlQuery, getStatus } from '$lib/api.js';
	import { setMysql } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	let configured = $state(false);
	let connected = $state(false);
	let connecting = $state(true);
	let dbInfo = $state({ host: '', port: 3306, database: '' });

	let sql = $state('');
	let queryResult = $state(null);
	let queryColumns = $state([]);
	let executing = $state(false);

	// Auto-detect and connect on mount
	$effect(() => {
		checkAndConnect();
	});

	async function checkAndConnect() {
		try {
			const status = await getStatus();
			const mysqlInfo = status.mysql || {};
			configured = mysqlInfo.gameDbConfigured !== false;
			dbInfo = { host: mysqlInfo.host || '', port: mysqlInfo.port || 3306, database: mysqlInfo.gameDb || '' };

			if (configured) {
				await mysqlConnect();
				connected = true;
				setMysql({ connected: true, host: dbInfo.host, port: dbInfo.port, database: dbInfo.database });
			}
		} catch {
			connected = false;
		} finally {
			connecting = false;
		}
	}

	async function reconnect() {
		connecting = true;
		try {
			await mysqlConnect();
			connected = true;
			setMysql({ connected: true, host: dbInfo.host, port: dbInfo.port, database: dbInfo.database });
			toastSuccess('Database reconnected');
		} catch (err) {
			connected = false;
			toastError(err.message);
		} finally {
			connecting = false;
		}
	}

	async function executeQuery() {
		if (!sql.trim() || !connected) return;
		executing = true;
		queryResult = null;
		queryColumns = [];
		try {
			const result = await mysqlQuery(sql.trim());
			const rows = result.rows || result.result || result.data || [];
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

<div class="w-full">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-obsidian-100">Database</h1>
		<div class="flex items-center gap-3">
			{#if configured && !connected && !connecting}
				<button
					onclick={reconnect}
					class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors"
				>
					Reconnect
				</button>
			{/if}
			<StatusIndicator
				status={connecting ? 'connecting' : connected ? 'connected' : 'disconnected'}
				label={connecting ? 'Connecting...' : connected ? `${dbInfo.host}:${dbInfo.port}/${dbInfo.database}` : configured ? 'Disconnected' : 'Not configured'}
			/>
		</div>
	</div>

	{#if connecting}
		<div class="card text-center py-8">
			<p class="text-obsidian-300">Connecting to database...</p>
		</div>
	{:else if !configured}
		<div class="card text-center py-8">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-10 h-10 text-obsidian-500 mx-auto mb-3">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/>
			</svg>
			<p class="text-obsidian-200 font-medium mb-1">Game database not configured</p>
			<p class="text-xs text-obsidian-400">Set <code class="bg-obsidian-700 px-1.5 py-0.5 rounded text-obsidian-200">WEB_PORTAL_GAME_DB_NAME</code> and database credentials in environment variables.</p>
		</div>
	{:else}
		<!-- SQL Editor -->
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-5 mb-4">
			<textarea
				bind:value={sql}
				onkeydown={handleKeydown}
				placeholder="Enter SQL query... (Ctrl+Enter to execute)"
				rows="4"
				class="w-full px-3 py-2 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm font-mono placeholder-obsidian-300 resize-y mb-3"
				spellcheck="false"
			></textarea>

			<button
				onclick={executeQuery}
				disabled={executing || !sql.trim() || !connected}
				class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg"
			>
				{executing ? 'Executing...' : 'Execute Query'}
			</button>
		</div>

		<!-- Results -->
		{#if queryResult !== null}
			<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl overflow-hidden">
				<div class="px-4 py-3 border-b border-obsidian-700">
					<span class="text-sm text-obsidian-200">
						{Array.isArray(queryResult) ? `${queryResult.length} rows` : 'Query executed'}
					</span>
				</div>

				{#if queryColumns.length > 0}
					<div class="overflow-x-auto max-h-[50vh]">
						<table class="w-full text-sm">
							<thead class="bg-obsidian-800 sticky top-0">
								<tr>
									{#each queryColumns as col}
										<th class="text-left px-4 py-2 text-obsidian-200 font-medium whitespace-nowrap">{col}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each queryResult as row}
									<tr class="border-t border-obsidian-700 hover:bg-obsidian-700/50">
										{#each queryColumns as col}
											<td class="px-4 py-2 text-obsidian-200 whitespace-nowrap">{row[col] ?? 'NULL'}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="p-4">
						<pre class="text-sm text-obsidian-200 font-mono">{JSON.stringify(queryResult, null, 2)}</pre>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
