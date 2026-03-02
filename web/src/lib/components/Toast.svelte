<script>
	import { getToasts, removeToast } from '$lib/stores/toast.svelte.js';

	const typeStyles = {
		success: 'bg-emerald-600/90 border-emerald-500',
		error: 'bg-rose-600/90 border-rose-500',
		warning: 'bg-amber-600/90 border-amber-500',
		info: 'bg-purple-600/90 border-purple-500'
	};
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
	{#each getToasts() as toast (toast.id)}
		<div
			class="px-4 py-3 rounded-lg border text-sm text-white shadow-lg backdrop-blur-sm transition-all duration-300 {typeStyles[toast.type] || typeStyles.info}"
			role="alert"
		>
			<div class="flex items-center justify-between gap-3">
				<span>{toast.message}</span>
				<button
					class="text-white/70 hover:text-white text-lg leading-none"
					onclick={() => removeToast(toast.id)}
				>
					&times;
				</button>
			</div>
		</div>
	{/each}
</div>
