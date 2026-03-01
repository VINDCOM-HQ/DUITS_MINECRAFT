<script>
	import { smbConnect, smbCommand, smbDisconnect } from '$lib/api.js';
	import { getSmb, setSmb } from '$lib/stores/connections.svelte.js';
	import { error as toastError, success as toastSuccess } from '$lib/stores/toast.svelte.js';
	import Modal from '$lib/components/Modal.svelte';

	let host = $state('');
	let share = $state('');
	let username = $state('');
	let password = $state('');
	let domain = $state('');
	let connecting = $state(false);

	let currentPath = $state('\\');
	let files = $state([]);
	let loadingFiles = $state(false);

	let editingFile = $state(null);
	let editContent = $state('');
	let editDirty = $state(false);

	let deleteTarget = $state(null);
	let deleteOpen = $state(false);

	let findQuery = $state('');
	let findMatches = $state([]);
	let findIndex = $state(0);

	async function connect() {
		connecting = true;
		try {
			const result = await smbConnect(host, share, username, password, domain);
			setSmb({ clientId: result.clientId, connected: true, host, share });
			toastSuccess('SMB connected');
			await loadDir('\\');
		} catch (err) {
			toastError(err.message);
		} finally {
			connecting = false;
		}
	}

	async function disconnect() {
		try {
			await smbDisconnect(getSmb().clientId);
		} catch (_) {}
		setSmb({ clientId: null, connected: false, host: '', share: '' });
		files = [];
		currentPath = '\\';
	}

	async function loadDir(path) {
		loadingFiles = true;
		try {
			const result = await smbCommand(getSmb().clientId, 'readdir', path);
			files = (result.list || []).sort((a, b) => {
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
			const newPath = currentPath === '\\' ? `\\${name}` : `${currentPath}\\${name}`;
			loadDir(newPath);
		} else {
			openFile(name);
		}
	}

	function goUp() {
		if (currentPath === '\\') return;
		const parts = currentPath.split('\\').filter(Boolean);
		parts.pop();
		loadDir(parts.length > 0 ? `\\${parts.join('\\')}` : '\\');
	}

	async function openFile(name) {
		const path = currentPath === '\\' ? `\\${name}` : `${currentPath}\\${name}`;
		try {
			const result = await smbCommand(getSmb().clientId, 'readFile', path, null, 'utf-8');
			editingFile = path;
			editContent = result.data || result.content || '';
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
			await smbCommand(getSmb().clientId, 'writeFile', editingFile, editContent, 'utf-8');
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
		const path = currentPath === '\\' ? `\\${deleteTarget.name}` : `${currentPath}\\${deleteTarget.name}`;
		try {
			await smbCommand(getSmb().clientId, 'unlink', path);
			toastSuccess(`Deleted ${deleteTarget.name}`);
			loadDir(currentPath);
		} catch (err) {
			toastError(err.message);
		}
		deleteOpen = false;
		deleteTarget = null;
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
				const path = currentPath === '\\' ? `\\${file.name}` : `${currentPath}\\${file.name}`;
				await smbCommand(getSmb().clientId, 'writeFile', path, content, 'base64');
				toastSuccess(`Uploaded ${file.name}`);
			} catch (err) {
				toastError(`Upload failed: ${file.name}`);
			}
		}
		loadDir(currentPath);
		e.target.value = '';
	}

	async function downloadFile(name) {
		const path = currentPath === '\\' ? `\\${name}` : `${currentPath}\\${name}`;
		try {
			const result = await smbCommand(getSmb().clientId, 'readFile', path, null, 'base64');
			const content = result.data || result.content || '';
			const blob = new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))]);
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
</script>

<div class="max-w-5xl">
	<h1 class="text-2xl font-bold text-gray-100 mb-6">File Browser</h1>

	<!-- Connection -->
	{#if !getSmb().connected}
		<div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
			<h2 class="text-sm font-medium text-gray-400 mb-4">SMB Connection</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
				<input type="text" bind:value={host} placeholder="Host (e.g. \\\\server)" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="text" bind:value={share} placeholder="Share name" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="text" bind:value={username} placeholder="Username" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="password" bind:value={password} placeholder="Password" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
				<input type="text" bind:value={domain} placeholder="Domain (optional)" class="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 text-sm placeholder-gray-500" />
			</div>
			<button
				onclick={connect}
				disabled={connecting || !host || !share}
				class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-sm rounded-lg"
			>
				{connecting ? 'Connecting...' : 'Connect'}
			</button>
		</div>
	{:else}
		<!-- File Browser -->
		{#if editingFile}
			<!-- File Editor -->
			<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4">
				<div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
					<span class="text-sm text-gray-300 font-mono">{editingFile}</span>
					<div class="flex gap-2">
						<button onclick={saveFile} disabled={!editDirty} class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-gray-500 text-white text-xs rounded-lg">Save</button>
						<button onclick={closeEditor} class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-gray-300 text-xs rounded-lg">Close</button>
					</div>
				</div>
				<!-- Find bar -->
				<div class="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-800/50">
					<input type="text" bind:value={findQuery} oninput={findInFile} placeholder="Find..." class="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-gray-100 text-xs" />
					<span class="text-xs text-gray-500">{findMatches.length} matches</span>
					<button onclick={() => { findIndex = Math.max(0, findIndex - 1); }} disabled={findMatches.length === 0} class="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50">Prev</button>
					<button onclick={() => { findIndex = Math.min(findMatches.length - 1, findIndex + 1); }} disabled={findMatches.length === 0} class="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50">Next</button>
				</div>
				<textarea
					bind:value={editContent}
					oninput={() => { editDirty = true; }}
					class="w-full h-96 p-4 bg-slate-950 text-gray-100 font-mono text-sm resize-none focus:outline-none"
					spellcheck="false"
				></textarea>
			</div>
		{:else}
			<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
				<div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
					<div class="flex items-center gap-2">
						<button onclick={goUp} disabled={currentPath === '\\'} class="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-gray-300 text-xs rounded">&larr; Back</button>
						<span class="text-sm text-gray-400 font-mono">{currentPath}</span>
					</div>
					<div class="flex gap-2">
						<label class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg cursor-pointer">
							Upload
							<input type="file" multiple onchange={handleUpload} class="hidden" />
						</label>
						<button onclick={() => loadDir(currentPath)} class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-gray-300 text-xs rounded-lg">{loadingFiles ? '...' : 'Refresh'}</button>
						<button onclick={disconnect} class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg">Disconnect</button>
					</div>
				</div>

				<div class="max-h-[60vh] overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="bg-slate-800 sticky top-0">
							<tr>
								<th class="text-left px-4 py-2 text-gray-400 font-medium">Name</th>
								<th class="text-right px-4 py-2 text-gray-400 font-medium w-24">Size</th>
								<th class="text-right px-4 py-2 text-gray-400 font-medium w-32">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each files as file}
								<tr class="border-t border-slate-800 hover:bg-slate-800/50">
									<td class="px-4 py-2">
										<button
											onclick={() => navigate(file.name, file.isDirectory)}
											class="text-left text-gray-200 hover:text-indigo-400 transition-colors"
										>
											<span class="text-gray-500 mr-2">{file.isDirectory ? '[DIR]' : '[FILE]'}</span>
											{file.name}
										</button>
									</td>
									<td class="text-right px-4 py-2 text-gray-500">{file.isDirectory ? '-' : formatSize(file.size)}</td>
									<td class="text-right px-4 py-2">
										{#if !file.isDirectory}
											<button onclick={() => downloadFile(file.name)} class="text-xs text-indigo-400 hover:text-indigo-300 mr-2">Download</button>
											<button onclick={() => confirmDelete(file)} class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
										{/if}
									</td>
								</tr>
							{/each}
							{#if files.length === 0 && !loadingFiles}
								<tr><td colspan="3" class="px-4 py-8 text-center text-gray-500 italic">Empty directory</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<Modal open={deleteOpen} title="Confirm Delete" onclose={() => { deleteOpen = false; }}>
	{#snippet children()}
		<p class="text-gray-300 mb-4">Delete <strong class="text-rose-400">{deleteTarget?.name}</strong>?</p>
		<div class="flex gap-2 justify-end">
			<button onclick={() => { deleteOpen = false; }} class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm rounded-lg">Cancel</button>
			<button onclick={executeDelete} class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg">Delete</button>
		</div>
	{/snippet}
</Modal>
