<script>
	/**
	 * Admin-only region draw/edit panel.
	 * @type {{
	 *   world: string,
	 *   onSave: (region: object) => Promise<void>,
	 *   onCancel: () => void
	 * }}
	 */
	let { world, onSave, onCancel } = $props();

	let name = $state('');
	let minX = $state('');
	let minZ = $state('');
	let maxX = $state('');
	let maxZ = $state('');
	let color = $state('#3388ff');
	let owner = $state('');
	let type = $state('claim');
	let saving = $state(false);
	let error = $state('');

	const REGION_TYPES = ['claim', 'spawn', 'shop', 'pvp', 'build', 'admin'];

	async function handleSave() {
		error = '';
		if (!name.trim()) { error = 'Name is required'; return; }
		if (minX === '' || minZ === '' || maxX === '' || maxZ === '') {
			error = 'All coordinates are required';
			return;
		}

		saving = true;
		try {
			await onSave({
				name: name.trim(),
				world,
				minX: parseInt(minX),
				minZ: parseInt(minZ),
				maxX: parseInt(maxX),
				maxZ: parseInt(maxZ),
				color,
				owner: owner.trim() || null,
				type
			});
		} catch (err) {
			error = err.message || 'Failed to save region';
		} finally {
			saving = false;
		}
	}

	const inputCls = 'w-full bg-obsidian-800 border border-obsidian-600 text-obsidian-100 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none';
</script>

<div class="absolute bottom-16 left-3 bg-obsidian-900/95 border border-obsidian-600 rounded-lg p-4 w-64 shadow-lg">
	<h3 class="text-sm font-semibold text-purple-400 mb-3">New Land Claim</h3>

	<div class="space-y-2">
		<div>
			<label class="block text-xs text-obsidian-300 mb-0.5">Name</label>
			<input class={inputCls} bind:value={name} placeholder="Spawn Town" />
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Min X</label>
				<input class={inputCls} type="number" bind:value={minX} placeholder="-100" />
			</div>
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Min Z</label>
				<input class={inputCls} type="number" bind:value={minZ} placeholder="-100" />
			</div>
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Max X</label>
				<input class={inputCls} type="number" bind:value={maxX} placeholder="100" />
			</div>
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Max Z</label>
				<input class={inputCls} type="number" bind:value={maxZ} placeholder="100" />
			</div>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Color</label>
				<input class="w-full h-7 rounded border border-obsidian-600 bg-obsidian-800 cursor-pointer"
					type="color" bind:value={color} />
			</div>
			<div>
				<label class="block text-xs text-obsidian-300 mb-0.5">Type</label>
				<select class={inputCls} bind:value={type}>
					{#each REGION_TYPES as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>
		</div>

		<div>
			<label class="block text-xs text-obsidian-300 mb-0.5">Owner (optional)</label>
			<input class={inputCls} bind:value={owner} placeholder="PlayerName" />
		</div>
	</div>

	{#if error}
		<p class="text-xs text-red-400 mt-2">{error}</p>
	{/if}

	<div class="flex gap-2 mt-3">
		<button
			onclick={handleSave}
			disabled={saving}
			class="flex-1 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-500
				disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			{saving ? 'Saving…' : 'Save Region'}
		</button>
		<button
			onclick={onCancel}
			class="px-3 py-1.5 text-xs bg-obsidian-700 text-obsidian-200 border border-obsidian-600
				rounded hover:bg-obsidian-600 transition-colors"
		>
			Cancel
		</button>
	</div>
</div>
