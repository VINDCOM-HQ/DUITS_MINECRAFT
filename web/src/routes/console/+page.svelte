<script>
	import { rconConnect, rconCommand, rconDisconnect } from '$lib/api.js';
	import { getRcon, setRcon } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	let host = $state('localhost');
	let port = $state(25575);
	let password = $state('');
	let command = $state('');
	let output = $state([]);
	let commandHistory = $state([]);
	let historyIndex = $state(-1);
	let connecting = $state(false);
	let outputEl = $state(null);

	const savedServers = $state(JSON.parse(localStorage.getItem('rcon_servers') || '[]'));
	let selectedServer = $state('');

	function loadServer(name) {
		const server = savedServers.find((s) => s.name === name);
		if (server) {
			host = server.host;
			port = server.port;
			password = server.password || '';
		}
	}

	function saveServer() {
		const name = prompt('Server name:');
		if (!name) return;
		const existing = savedServers.findIndex((s) => s.name === name);
		const entry = { name, host, port, password };
		if (existing >= 0) {
			savedServers[existing] = entry;
		} else {
			savedServers.push(entry);
		}
		localStorage.setItem('rcon_servers', JSON.stringify(savedServers));
		toastSuccess('Server saved');
	}

	async function connect() {
		connecting = true;
		try {
			const result = await rconConnect(host, port, password);
			setRcon({ clientId: result.clientId, connected: true, host, port });
			appendOutput('[Connected to server]', 'info');
			toastSuccess('RCON connected');
		} catch (err) {
			appendOutput(`[Connection failed: ${err.message}]`, 'error');
			toastError(err.message);
		} finally {
			connecting = false;
		}
	}

	async function disconnect() {
		try {
			await rconDisconnect(getRcon().clientId);
		} catch (_) {
			// ignore
		}
		setRcon({ clientId: null, connected: false, host: '', port: 25575 });
		appendOutput('[Disconnected]', 'info');
	}

	async function sendCommand() {
		const cmd = command.trim();
		if (!cmd || !getRcon().clientId) return;

		appendOutput(`> ${cmd}`, 'command');
		commandHistory = [...commandHistory, cmd];
		historyIndex = -1;
		command = '';

		try {
			const result = await rconCommand(getRcon().clientId, cmd);
			const response = result.response || result.data || '';
			if (response) {
				appendOutput(response, 'response');
			}
		} catch (err) {
			appendOutput(`[Error: ${err.message}]`, 'error');
		}
	}

	function appendOutput(text, type = 'response') {
		output = [...output, { text, type, time: new Date().toLocaleTimeString() }];
		requestAnimationFrame(() => {
			if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
		});
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			sendCommand();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (commandHistory.length > 0) {
				historyIndex = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
				command = commandHistory[historyIndex];
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (historyIndex >= 0) {
				historyIndex = historyIndex + 1;
				command = historyIndex < commandHistory.length ? commandHistory[historyIndex] : '';
				if (historyIndex >= commandHistory.length) historyIndex = -1;
			}
		}
	}

	const outputColors = {
		command: 'text-indigo-400',
		response: 'text-emerald-400',
		error: 'text-rose-400',
		info: 'text-gray-400'
	};
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">RCON Console</h1>

	<!-- Connection Form -->
	<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-sm font-medium text-gray-400">Connection</h2>
			<StatusIndicator status={getRcon().connected ? 'connected' : 'disconnected'} label={getRcon().connected ? 'Connected' : 'Disconnected'} />
		</div>

		{#if savedServers.length > 0}
			<div class="mb-3">
				<select
					bind:value={selectedServer}
					onchange={() => loadServer(selectedServer)}
					class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm"
				>
					<option value="">-- Saved Servers --</option>
					{#each savedServers as server}
						<option value={server.name}>{server.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
			<input
				type="text"
				bind:value={host}
				placeholder="Host"
				disabled={getRcon().connected}
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500 disabled:opacity-50"
			/>
			<input
				type="number"
				bind:value={port}
				placeholder="Port"
				disabled={getRcon().connected}
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500 disabled:opacity-50"
			/>
			<input
				type="password"
				bind:value={password}
				placeholder="Password"
				disabled={getRcon().connected}
				class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500 disabled:opacity-50"
			/>
		</div>

		<div class="flex gap-2">
			{#if getRcon().connected}
				<button
					onclick={disconnect}
					class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg transition-colors"
				>
					Disconnect
				</button>
			{:else}
				<button
					onclick={connect}
					disabled={connecting || !host || !password}
					class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
				>
					{connecting ? 'Connecting...' : 'Connect'}
				</button>
			{/if}
			<button
				onclick={saveServer}
				class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm rounded-lg transition-colors"
			>
				Save Server
			</button>
		</div>
	</div>

	<!-- Console Output -->
	<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
		<div
			bind:this={outputEl}
			class="h-96 overflow-y-auto p-4 terminal-output bg-slate-950"
		>
			{#if output.length === 0}
				<div class="text-gray-600 italic">Console output will appear here...</div>
			{/if}
			{#each output as line}
				<div class="{outputColors[line.type] || 'text-gray-300'}">
					<span class="text-gray-600 text-xs mr-2">[{line.time}]</span>{line.text}
				</div>
			{/each}
		</div>

		<div class="border-t border-slate-800 p-3 flex gap-2">
			<span class="text-indigo-400 font-mono self-center">&gt;</span>
			<input
				type="text"
				bind:value={command}
				onkeydown={handleKeydown}
				placeholder={getRcon().connected ? 'Enter command...' : 'Connect to server first'}
				disabled={!getRcon().connected}
				class="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm font-mono placeholder-gray-500 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
			/>
			<button
				onclick={sendCommand}
				disabled={!getRcon().connected || !command.trim()}
				class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
			>
				Send
			</button>
		</div>
	</div>
</div>
