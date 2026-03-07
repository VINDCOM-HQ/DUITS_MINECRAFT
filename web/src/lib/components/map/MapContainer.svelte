<script>
	/**
	 * Wraps the map canvas and all overlay layers into a single component.
	 * Emits canvas ref via bind so the parent can draw to it.
	 *
	 * @type {{
	 *   canvasEl: HTMLCanvasElement | null,
	 *   onMouseDown: (e: MouseEvent) => void,
	 *   onMouseMove: (e: MouseEvent) => void,
	 *   onMouseUp: (e: MouseEvent) => void,
	 *   children?: import('svelte').Snippet
	 * }}
	 */
	let { canvasEl = $bindable(null), onMouseDown, onMouseMove, onMouseUp, children } = $props();
</script>

<div class="flex-1 relative overflow-hidden bg-obsidian-950">
	<canvas
		bind:this={canvasEl}
		class="w-full h-full cursor-grab active:cursor-grabbing"
		onmousedown={onMouseDown}
		onmousemove={onMouseMove}
		onmouseup={onMouseUp}
		onmouseleave={onMouseUp}
	></canvas>

	<!-- Overlay slot for controls, sidebars, popups -->
	{@render children?.()}
</div>
