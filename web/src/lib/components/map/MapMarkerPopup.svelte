<script>
	/** @type {{ marker: object | null, onClose: () => void }} */
	let { marker, onClose } = $props();

	function formatTime(ts) {
		if (!ts) return 'Unknown';
		return new Date(ts).toLocaleString();
	}
</script>

{#if marker}
	<div class="absolute inset-0 pointer-events-none flex items-end justify-center pb-20">
		<div class="pointer-events-auto bg-obsidian-900/95 border border-obsidian-600 rounded-lg p-4 max-w-xs shadow-lg">
			<div class="flex items-start justify-between mb-2">
				<h3 class="text-sm font-semibold text-purple-400">
					{#if marker.type === 'death'}
						☠ Death Marker
					{:else if marker.type === 'respawn'}
						🛏 Respawn Point
					{:else}
						📍 Marker
					{/if}
				</h3>
				<button
					onclick={onClose}
					class="text-obsidian-400 hover:text-obsidian-100 ml-3 text-lg leading-none"
					aria-label="Close"
				>
					×
				</button>
			</div>

			{#if marker.name}
				<p class="text-sm text-obsidian-100 mb-1">{marker.name}</p>
			{/if}

			{#if marker.cause}
				<p class="text-xs text-obsidian-300 italic mb-2">{marker.cause}</p>
			{/if}

			<p class="text-xs font-mono text-obsidian-300">
				{marker.x?.toFixed(1)}, {marker.y?.toFixed(1)}, {marker.z?.toFixed(1)}
			</p>

			{#if marker.t}
				<p class="text-xs text-obsidian-500 mt-1">{formatTime(marker.t)}</p>
			{/if}
		</div>
	</div>
{/if}
