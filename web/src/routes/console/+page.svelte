<script>
	import { rconCommand, rconStatus, rconConnect } from '$lib/api.js';
	import { setRcon } from '$lib/stores/connections.svelte.js';
	import { connectLogStream, getStreamStatus } from '$lib/stores/log-stream.svelte.js';
	import { parseLogLine } from '$lib/utils/parse-log-line.js';
	import { error as toastError } from '$lib/stores/toast.svelte.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	let command = $state('');
	let output = $state([]);
	let commandHistory = $state([]);
	let historyIndex = $state(-1);
	let outputEl = $state(null);
	let connected = $state(false);
	let connecting = $state(true);
	let autoScroll = $state(true);

	const MAX_OUTPUT_LINES = 5000;

	// Auto-connect RCON on mount
	$effect(() => {
		checkAndConnect();
	});

	// Connect log stream on mount
	$effect(() => {
		const cleanup = connectLogStream(
			(lines, isInitial) => {
				const parsed = lines.map((raw) => {
					const info = parseLogLine(raw);
					return {
						text: info.text,
						type: info.type,
						time: info.time || new Date().toLocaleTimeString()
					};
				});

				if (isInitial) {
					// Prepend history before any existing RCON output
					output = [...parsed, ...output];
				} else {
					output = [...output, ...parsed];
				}

				// Cap output to prevent memory issues
				if (output.length > MAX_OUTPUT_LINES) {
					output = output.slice(output.length - MAX_OUTPUT_LINES);
				}

				requestAnimationFrame(scrollToBottom);
			},
			(errorMsg) => {
				appendOutput(`[Log stream: ${errorMsg}]`, 'info');
			}
		);

		return () => cleanup();
	});

	async function checkAndConnect() {
		try {
			const result = await rconStatus();
			connected = result.connected;

			if (!connected) {
				await rconConnect();
				connected = true;
			}

			if (connected) {
				setRcon({ connected: true, host: result.host || '', port: result.port || 25575 });
				appendOutput('[RCON connected]', 'info');
			}
		} catch {
			connected = false;
			appendOutput('[RCON unavailable — server may not be running]', 'error');
		} finally {
			connecting = false;
		}
	}

	async function reconnect() {
		connecting = true;
		try {
			await rconConnect();
			connected = true;
			setRcon({ connected: true });
			appendOutput('[RCON reconnected]', 'info');
		} catch (err) {
			connected = false;
			appendOutput(`[Reconnect failed: ${err.message}]`, 'error');
			toastError(err.message);
		} finally {
			connecting = false;
		}
	}

	async function sendCommand() {
		const cmd = command.trim();
		if (!cmd) return;

		appendOutput(`> ${cmd}`, 'command');
		commandHistory = [...commandHistory, cmd];
		historyIndex = -1;
		command = '';

		try {
			const result = await rconCommand(cmd);
			connected = true;
			const response = result.response || result.data || '';
			if (response) {
				appendOutput(response, 'response');
			}
		} catch (err) {
			appendOutput(`[Error: ${err.message}]`, 'error');
			if (err.message.includes('not connected') || err.message.includes('ECONNREFUSED')) {
				connected = false;
			}
		}
	}

	function appendOutput(text, type = 'response') {
		output = [...output, { text, type, time: new Date().toLocaleTimeString() }];

		if (output.length > MAX_OUTPUT_LINES) {
			output = output.slice(output.length - MAX_OUTPUT_LINES);
		}

		requestAnimationFrame(scrollToBottom);
	}

	function scrollToBottom() {
		if (autoScroll && outputEl) {
			outputEl.scrollTop = outputEl.scrollHeight;
		}
	}

	function handleScroll() {
		if (!outputEl) return;
		const { scrollTop, scrollHeight, clientHeight } = outputEl;
		autoScroll = scrollHeight - scrollTop - clientHeight < 50;
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

	function clearOutput() {
		output = [];
	}

	const logStreamStatus = $derived(getStreamStatus());

	const outputColors = {
		command: 'text-purple-400',
		response: 'text-emerald-400',
		error: 'text-rose-400',
		info: 'text-obsidian-200',
		log: 'text-obsidian-300',
		'log-warn': 'text-amber-400',
		'log-error': 'text-rose-400'
	};
</script>

<div class="w-full">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-obsidian-100">Server Console</h1>
		<div class="flex items-center gap-3">
			{#if !connected && !connecting}
				<button
					onclick={reconnect}
					class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors"
				>
					Reconnect
				</button>
			{/if}
			<StatusIndicator
				status={logStreamStatus === 'connected' ? 'connected' : logStreamStatus === 'connecting' ? 'connecting' : 'disconnected'}
				label={logStreamStatus === 'connected' ? 'Log stream' : logStreamStatus === 'connecting' ? 'Connecting...' : 'Log offline'}
			/>
			<StatusIndicator
				status={connecting ? 'connecting' : connected ? 'connected' : 'disconnected'}
				label={connecting ? 'RCON...' : connected ? 'RCON' : 'RCON off'}
			/>
		</div>
	</div>

	<!-- Console Output -->
	<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl overflow-hidden">
		<div class="flex items-center justify-between px-4 py-2 border-b border-obsidian-700 bg-obsidian-800/50">
			<div class="flex items-center gap-3">
				<span class="text-xs text-obsidian-300 font-mono">Server Console</span>
				{#if !autoScroll}
					<button
						onclick={() => { autoScroll = true; scrollToBottom(); }}
						class="text-xs text-purple-400 hover:text-purple-300 transition-colors"
					>
						↓ Scroll to bottom
					</button>
				{/if}
			</div>
			<button
				onclick={clearOutput}
				class="text-xs text-obsidian-400 hover:text-obsidian-200 transition-colors"
			>
				Clear
			</button>
		</div>

		<div
			bind:this={outputEl}
			onscroll={handleScroll}
			class="h-[calc(100vh-16rem)] min-h-80 overflow-y-auto p-4 terminal-output bg-obsidian-950"
		>
			{#if connecting && output.length === 0}
				<div class="text-obsidian-400 italic">Connecting...</div>
			{:else if output.length === 0}
				<div class="text-obsidian-400 italic">Waiting for log data...</div>
			{/if}
			{#each output as line}
				<div class="font-mono text-sm leading-relaxed {outputColors[line.type] || 'text-obsidian-200'}">
					<span class="text-obsidian-500 text-xs mr-2 select-none">[{line.time}]</span>{line.text}
				</div>
			{/each}
		</div>

		<div class="border-t border-obsidian-700 p-3 flex gap-2">
			<span class="text-purple-400 font-mono self-center">&gt;</span>
			<input
				type="text"
				bind:value={command}
				onkeydown={handleKeydown}
				placeholder={connected ? 'Enter RCON command...' : 'Waiting for RCON connection...'}
				disabled={!connected}
				class="flex-1 px-3 py-2 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 text-sm font-mono placeholder-obsidian-300 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-purple-500"
			/>
			<button
				onclick={sendCommand}
				disabled={!connected || !command.trim()}
				class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg transition-colors"
			>
				Send
			</button>
		</div>
	</div>
</div>
