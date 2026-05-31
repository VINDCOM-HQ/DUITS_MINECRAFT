<script>
	let { status = 'disconnected', label = '' } = $props();

	const colors = {
		connected: 'bg-emerald-500',
		disconnected: 'bg-obsidian-500',
		connecting: 'bg-amber-500 animate-pulse',
		error: 'bg-rose-500'
	};
</script>

<div class="flex items-center gap-2">
	<span class="inline-block w-2.5 h-2.5 rounded-full {colors[status] || colors.disconnected}"></span>
	{#if label}
		<span class="text-xs text-obsidian-200">{label}</span>
	{/if}
</div>
