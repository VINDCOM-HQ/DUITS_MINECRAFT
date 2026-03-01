<script>
	let { status = 'disconnected', label = '' } = $props();

	const colors = {
		connected: 'bg-emerald-500',
		disconnected: 'bg-slate-600',
		connecting: 'bg-amber-500 animate-pulse',
		error: 'bg-rose-500'
	};
</script>

<div class="flex items-center gap-2">
	<span class="inline-block w-2.5 h-2.5 rounded-full {colors[status] || colors.disconnected}"></span>
	{#if label}
		<span class="text-xs text-gray-400">{label}</span>
	{/if}
</div>
