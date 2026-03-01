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
		class="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
		onclick={handleBackdrop}
		onkeydown={handleKeydown}
	>
		<div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto">
			<div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
				<h3 class="text-lg font-semibold text-gray-100">{title}</h3>
				<button
					class="text-gray-400 hover:text-gray-200 text-xl leading-none"
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
