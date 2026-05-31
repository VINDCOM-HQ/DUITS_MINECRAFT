<script>
	import { mapPlayers } from '$lib/api.js';

	let players = $state([]);
	let mapServerOnline = $state(false);
	let checkingStatus = $state(true);
	let showPlayerList = $state(false);

	$effect(() => {
		const fetchPlayers = async () => {
			try {
				const result = await mapPlayers();
				players = result.players || [];
				mapServerOnline = true;
			} catch {
				players = [];
				mapServerOnline = false;
			} finally {
				checkingStatus = false;
			}
		};

		fetchPlayers();
		const interval = setInterval(fetchPlayers, 5000);
		return () => clearInterval(interval);
	});
</script>

<div class="absolute inset-0 flex flex-col">

	<!-- ── Header bar ── -->
	<div class="shrink-0 flex items-center justify-between px-5 h-12 bg-obsidian-900/95 backdrop-blur-sm border-b border-obsidian-700/60">

		<!-- Left: title + status -->
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-1.5">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-purple-400">
					<path fill-rule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.251v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.083-1.69A1.5 1.5 0 0018 14.748V3.872a1.5 1.5 0 00-2.073-1.386l-3.51 1.452-4.26-1.763zM7.58 5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 017.58 5zm5.59 2.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5z" clip-rule="evenodd"/>
				</svg>
				<span class="text-sm font-semibold text-obsidian-100">World Map</span>
			</div>

			<div class="h-4 w-px bg-obsidian-700"></div>

			<!-- Status pill -->
			{#if checkingStatus}
				<span class="flex items-center gap-1.5 text-xs text-obsidian-400">
					<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
					Connecting
				</span>
			{:else if mapServerOnline}
				<span class="flex items-center gap-1.5 text-xs text-emerald-400">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_theme(colors.emerald.400)]"></span>
					Live
				</span>
			{:else}
				<span class="flex items-center gap-1.5 text-xs text-rose-400">
					<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
					Offline
				</span>
			{/if}
		</div>

		<!-- Right: player count + dropdown -->
		{#if mapServerOnline}
			<div class="relative">
				<button
					onclick={() => (showPlayerList = !showPlayerList)}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
						{players.length > 0
							? 'text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20'
							: 'text-obsidian-400 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700'}"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
						<path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7.5 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z"/>
					</svg>
					{players.length} player{players.length !== 1 ? 's' : ''} online
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 opacity-60 transition-transform {showPlayerList ? 'rotate-180' : ''}">
						<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
					</svg>
				</button>

				{#if showPlayerList}
					<div class="absolute right-0 mt-1 w-52 z-10 rounded-xl bg-obsidian-900 border border-obsidian-700 shadow-2xl overflow-hidden">
						<div class="px-3 py-2 border-b border-obsidian-800">
							<span class="text-[10px] font-semibold text-obsidian-500 uppercase tracking-widest">Online Now</span>
						</div>
						{#if players.length === 0}
							<p class="px-3 py-4 text-xs text-center text-obsidian-500">No players online</p>
						{:else}
							<ul class="py-1 max-h-64 overflow-y-auto">
								{#each players as player}
									<li class="flex items-center gap-2.5 px-3 py-2 hover:bg-obsidian-800 transition-colors">
										<img
											src="https://mc-heads.net/avatar/{player.uuid || player.name}/16"
											alt={player.name}
											class="w-5 h-5 rounded-sm shrink-0"
											onerror={(e) => { e.currentTarget.style.display = 'none'; }}
										/>
										<div class="min-w-0">
											<p class="text-xs font-medium text-obsidian-100 truncate">{player.name}</p>
											{#if player.world}
												<p class="text-[10px] text-obsidian-500 truncate">{player.world.replace('minecraft:', '')}</p>
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- ── Map area ── -->
	<div class="flex-1 min-h-0">
		{#if !checkingStatus && !mapServerOnline}
			<div class="flex items-center justify-center h-full">
				<div class="text-center max-w-sm px-6">
					<div class="relative mx-auto mb-6 w-16 h-16">
						<div class="absolute inset-0 rounded-full bg-rose-500/10 animate-ping"></div>
						<div class="relative flex items-center justify-center w-16 h-16 rounded-full bg-obsidian-800 border border-obsidian-700">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-7 h-7 text-obsidian-400">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
							</svg>
						</div>
					</div>
					<h3 class="text-base font-semibold text-obsidian-100 mb-1.5">Map Server Offline</h3>
					<p class="text-sm text-obsidian-500 leading-relaxed mb-5">Enable the world map in your config and restart.</p>
					<div class="text-left rounded-lg bg-obsidian-900 border border-obsidian-700 overflow-hidden">
						<div class="px-3 py-1.5 bg-obsidian-800 border-b border-obsidian-700 flex items-center gap-1.5">
							<div class="w-2 h-2 rounded-full bg-rose-500/60"></div>
							<div class="w-2 h-2 rounded-full bg-amber-500/60"></div>
							<div class="w-2 h-2 rounded-full bg-green-500/60"></div>
							<span class="ml-1 text-[10px] text-obsidian-500 font-mono">netherdeck.yml</span>
						</div>
						<pre class="px-4 py-3 text-xs font-mono text-emerald-400 leading-relaxed">world-map:
  enabled: <span class="text-purple-400">true</span>
  http-port: <span class="text-amber-400">8100</span></pre>
					</div>
				</div>
			</div>
		{:else}
			<iframe
				src="/api/map/bluemap"
				class="w-full h-full border-0 block"
				title="NetherDeck World Map"
				allow="fullscreen"
			></iframe>
		{/if}
	</div>

</div>
