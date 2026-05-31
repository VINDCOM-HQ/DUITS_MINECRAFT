<script>
	import { filesList, filesRead, filesWrite, filesDelete, filesMkdir, filesUpload } from '$lib/api.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import Modal from '$lib/components/Modal.svelte';

	let currentPath = $state('');
	let files = $state([]);
	let loadingFiles = $state(false);

	let editingFile = $state(null);
	let editContent = $state('');
	let editDirty = $state(false);

	let deleteTarget = $state(null);
	let deleteOpen = $state(false);

	let mkdirOpen = $state(false);
	let mkdirName = $state('');

	let findQuery = $state('');
	let findMatches = $state([]);
	let findIndex = $state(0);

	// Load root directory on mount
	$effect(() => {
		loadDir('');
	});

	async function loadDir(path) {
		loadingFiles = true;
		try {
			const result = await filesList(path);
			files = (result.entries || []).sort((a, b) => {
				if (a.isDirectory && !b.isDirectory) return -1;
				if (!a.isDirectory && b.isDirectory) return 1;
				return a.name.localeCompare(b.name);
			});
			currentPath = path;
		} catch (err) {
			toastError(err.message);
		} finally {
			loadingFiles = false;
		}
	}

	function navigate(name, isDir) {
		if (isDir) {
			const newPath = currentPath ? `${currentPath}/${name}` : name;
			loadDir(newPath);
		} else {
			openFile(name);
		}
	}

	function goUp() {
		if (!currentPath) return;
		const parts = currentPath.split('/').filter(Boolean);
		parts.pop();
		loadDir(parts.join('/'));
	}

	async function openFile(name) {
		const path = currentPath ? `${currentPath}/${name}` : name;
		try {
			const result = await filesRead(path);
			editingFile = path;
			editContent = result.content || '';
			editDirty = false;
			findQuery = '';
			findMatches = [];
		} catch (err) {
			toastError(err.message);
		}
	}

	async function saveFile() {
		if (!editingFile) return;
		try {
			await filesWrite(editingFile, editContent, false);
			toastSuccess('File saved');
			editDirty = false;
		} catch (err) {
			toastError(err.message);
		}
	}

	function closeEditor() {
		if (editDirty && !confirm('Discard unsaved changes?')) return;
		editingFile = null;
		editContent = '';
		editDirty = false;
	}

	function confirmDelete(file) {
		deleteTarget = file;
		deleteOpen = true;
	}

	async function executeDelete() {
		if (!deleteTarget) return;
		const path = currentPath ? `${currentPath}/${deleteTarget.name}` : deleteTarget.name;
		try {
			await filesDelete(path);
			toastSuccess(`Deleted ${deleteTarget.name}`);
			loadDir(currentPath);
		} catch (err) {
			toastError(err.message);
		}
		deleteOpen = false;
		deleteTarget = null;
	}

	async function createDirectory() {
		const name = mkdirName.trim();
		if (!name) return;
		const path = currentPath ? `${currentPath}/${name}` : name;
		try {
			await filesMkdir(path);
			toastSuccess(`Created directory ${name}`);
			loadDir(currentPath);
		} catch (err) {
			toastError(err.message);
		}
		mkdirOpen = false;
		mkdirName = '';
	}

	async function handleUpload(e) {
		const uploadFiles = e.target.files;
		if (!uploadFiles || uploadFiles.length === 0) return;

		for (const file of uploadFiles) {
			try {
				const reader = new FileReader();
				const content = await new Promise((resolve, reject) => {
					reader.onload = () => resolve(reader.result.split(',')[1]);
					reader.onerror = reject;
					reader.readAsDataURL(file);
				});
				const path = currentPath ? `${currentPath}/${file.name}` : file.name;
				await filesUpload(path, content, true);
				toastSuccess(`Uploaded ${file.name}`);
			} catch (err) {
				toastError(`Upload failed: ${file.name}`);
			}
		}
		loadDir(currentPath);
		e.target.value = '';
	}

	async function downloadFile(name) {
		const path = currentPath ? `${currentPath}/${name}` : name;
		try {
			const result = await filesRead(path);
			const content = result.content || '';
			const blob = new Blob([content], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = name;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			toastError(err.message);
		}
	}

	function findInFile() {
		if (!findQuery || !editContent) {
			findMatches = [];
			return;
		}
		const matches = [];
		let idx = editContent.indexOf(findQuery);
		while (idx !== -1) {
			matches.push(idx);
			idx = editContent.indexOf(findQuery, idx + 1);
		}
		findMatches = matches;
		findIndex = 0;
	}

	function formatSize(bytes) {
		if (!bytes || bytes === 0) return '-';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	const breadcrumbs = $derived.by(() => {
		const parts = currentPath.split('/').filter(Boolean);
		return parts.map((part, i) => ({
			name: part,
			path: parts.slice(0, i + 1).join('/')
		}));
	});
</script>

<div class="w-full">
	<h1 class="text-2xl font-bold text-obsidian-100 mb-6">File Browser</h1>

	{#if editingFile}
		<!-- File Editor -->
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl overflow-hidden mb-4">
			<div class="flex items-center justify-between px-4 py-3 border-b border-obsidian-700">
				<span class="text-sm text-obsidian-200 font-mono">{editingFile}</span>
				<div class="flex gap-2">
					<button onclick={saveFile} disabled={!editDirty} class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-xs rounded-lg">Save</button>
					<button onclick={closeEditor} class="px-3 py-1 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-xs rounded-lg">Close</button>
				</div>
			</div>
			<!-- Find bar -->
			<div class="flex items-center gap-2 px-4 py-2 border-b border-obsidian-700 bg-obsidian-700/50">
				<input type="text" bind:value={findQuery} oninput={findInFile} placeholder="Find..." class="flex-1 px-2 py-1 bg-obsidian-800 border border-obsidian-600 rounded text-obsidian-100 text-xs" />
				<span class="text-xs text-obsidian-300">{findMatches.length} matches</span>
				<button onclick={() => { findIndex = Math.max(0, findIndex - 1); }} disabled={findMatches.length === 0} class="text-xs text-obsidian-200 hover:text-obsidian-100 disabled:opacity-50">Prev</button>
				<button onclick={() => { findIndex = Math.min(findMatches.length - 1, findIndex + 1); }} disabled={findMatches.length === 0} class="text-xs text-obsidian-200 hover:text-obsidian-100 disabled:opacity-50">Next</button>
			</div>
			<textarea
				bind:value={editContent}
				oninput={() => { editDirty = true; }}
				class="w-full h-96 p-4 bg-obsidian-950 text-obsidian-100 font-mono text-sm resize-none focus:outline-none"
				spellcheck="false"
			></textarea>
		</div>
	{:else}
		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl overflow-hidden">
			<div class="flex items-center justify-between px-4 py-3 border-b border-obsidian-700">
				<div class="flex items-center gap-2">
					<button onclick={goUp} disabled={!currentPath} class="px-2 py-1 bg-obsidian-800 hover:bg-obsidian-700 disabled:opacity-50 text-obsidian-200 text-xs rounded">&larr; Back</button>
					<span class="text-sm text-obsidian-200 font-mono">/{currentPath || ''}</span>
				</div>
				<div class="flex gap-2">
					<button onclick={() => { mkdirOpen = true; }} class="px-3 py-1 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-xs rounded-lg">New Folder</button>
					<label class="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg cursor-pointer">
						Upload
						<input type="file" multiple onchange={handleUpload} class="hidden" />
					</label>
					<button onclick={() => loadDir(currentPath)} class="px-3 py-1 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-xs rounded-lg">{loadingFiles ? '...' : 'Refresh'}</button>
				</div>
			</div>

			<div class="max-h-[60vh] overflow-y-auto">
				<table class="w-full text-sm">
					<thead class="bg-obsidian-800 sticky top-0">
						<tr>
							<th class="text-left px-4 py-2 text-obsidian-200 font-medium">Name</th>
							<th class="text-right px-4 py-2 text-obsidian-200 font-medium w-24">Size</th>
							<th class="text-right px-4 py-2 text-obsidian-200 font-medium w-32">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each files as file}
							<tr class="border-t border-obsidian-700 hover:bg-obsidian-700/50">
								<td class="px-4 py-2">
									<button
										onclick={() => navigate(file.name, file.isDirectory)}
										class="text-left text-obsidian-100 hover:text-purple-400 transition-colors"
									>
										<span class="text-obsidian-300 mr-2">{file.isDirectory ? '[DIR]' : '[FILE]'}</span>
										{file.name}
									</button>
								</td>
								<td class="text-right px-4 py-2 text-obsidian-300">{file.isDirectory ? '-' : formatSize(file.size)}</td>
								<td class="text-right px-4 py-2">
									{#if !file.isDirectory}
										<button onclick={() => downloadFile(file.name)} class="text-xs text-purple-400 hover:text-purple-300 mr-2">Download</button>
										<button onclick={() => confirmDelete(file)} class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
									{/if}
								</td>
							</tr>
						{/each}
						{#if files.length === 0 && !loadingFiles}
							<tr><td colspan="3" class="px-4 py-8 text-center text-obsidian-300 italic">Empty directory</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<Modal open={deleteOpen} title="Confirm Delete" onclose={() => { deleteOpen = false; }}>
	{#snippet children()}
		<p class="text-obsidian-200 mb-4">Delete <strong class="text-rose-400">{deleteTarget?.name}</strong>?</p>
		<div class="flex gap-2 justify-end">
			<button onclick={() => { deleteOpen = false; }} class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg">Cancel</button>
			<button onclick={executeDelete} class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg">Delete</button>
		</div>
	{/snippet}
</Modal>

<Modal open={mkdirOpen} title="New Folder" onclose={() => { mkdirOpen = false; }}>
	{#snippet children()}
		<input
			type="text"
			bind:value={mkdirName}
			placeholder="Folder name"
			class="w-full px-3 py-2 bg-obsidian-700 border border-obsidian-500 rounded-lg text-obsidian-100 text-sm mb-4"
			onkeydown={(e) => { if (e.key === 'Enter') createDirectory(); }}
		/>
		<div class="flex gap-2 justify-end">
			<button onclick={() => { mkdirOpen = false; }} class="px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-obsidian-200 text-sm rounded-lg">Cancel</button>
			<button onclick={createDirectory} disabled={!mkdirName.trim()} class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white text-sm rounded-lg">Create</button>
		</div>
	{/snippet}
</Modal>
