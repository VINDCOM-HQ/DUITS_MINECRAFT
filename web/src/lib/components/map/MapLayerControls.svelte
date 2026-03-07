<script>
	/** @type {{ layers: import('./types').LayerState, onToggle: (key: string) => void }} */
	let { layers, onToggle } = $props();

	const LAYER_DEFS = [
		{ key: 'trails', label: 'Player Trails', icon: '〰' },
		{ key: 'deaths', label: 'Death Markers', icon: '💀' },
		{ key: 'respawns', label: 'Bed Markers', icon: '🛏' },
		{ key: 'regions', label: 'Land Claims', icon: '⬜' },
		{ key: 'heatmap', label: 'Entity Heatmap', icon: '🔥' }
	];
</script>

<div class="absolute top-3 left-3 bg-obsidian-900/90 border border-obsidian-700 rounded-lg p-3 min-w-40">
	<h4 class="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider">Layers</h4>
	<ul class="space-y-1.5">
		{#each LAYER_DEFS as def}
			<li>
				<button
					onclick={() => onToggle(def.key)}
					class="flex items-center gap-2 w-full text-left text-xs rounded px-1.5 py-1 transition-colors
						{layers[def.key]
							? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
							: 'text-obsidian-300 hover:bg-obsidian-800'}"
				>
					<span class="w-5 text-center">{def.icon}</span>
					<span>{def.label}</span>
					<span class="ml-auto text-xs font-mono">
						{layers[def.key] ? 'on' : 'off'}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
