<script>
	let { open = false, title = '', onclose = () => {}, children } = $props();

	function handleBackdrop(e) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
		onclick={handleBackdrop}
		onkeydown={handleKeydown}
	>
		<div class="bg-obsidian-800 border border-obsidian-500 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto">
			<div class="flex items-center justify-between px-5 py-4 border-b border-obsidian-600">
				<h3 class="text-lg font-semibold text-obsidian-100">{title}</h3>
				<button
					class="text-obsidian-200 hover:text-purple-400 text-xl leading-none transition-colors"
					onclick={onclose}
				>
					&times;
				</button>
			</div>
			<div class="p-5">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
