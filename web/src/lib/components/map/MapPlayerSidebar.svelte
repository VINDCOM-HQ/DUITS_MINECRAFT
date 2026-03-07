<script>
	/** @type {{ players: Array<{name: string, uuid: string, world: string, x: number, y: number, z: number}>, onLocate: (player: object) => void }} */
	let { players, onLocate } = $props();
</script>

{#if players.length > 0}
	<div class="absolute top-3 right-3 bg-obsidian-900/90 border border-obsidian-700 rounded-lg p-3 max-w-52">
		<h4 class="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider">
			Players ({players.length})
		</h4>
		<ul class="space-y-1">
			{#each players as player}
				<li>
					<button
						onclick={() => onLocate(player)}
						class="flex items-center gap-2 w-full text-left text-xs rounded px-1.5 py-1
							hover:bg-obsidian-700 transition-colors group"
						title="Click to locate {player.name}"
					>
						<span class="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
						<span class="text-obsidian-100 truncate flex-1">{player.name}</span>
						<span class="text-obsidian-500 font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity">
							locate
						</span>
					</button>
					<p class="text-obsidian-500 text-xs pl-4 font-mono leading-tight">
						{player.x.toFixed(0)}, {player.y.toFixed(0)}, {player.z.toFixed(0)}
					</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}
