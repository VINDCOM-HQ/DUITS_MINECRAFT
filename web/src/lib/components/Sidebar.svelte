<script>
	import { page } from '$app/state';
	import StatusIndicator from './StatusIndicator.svelte';
	import { getRcon, setRcon, getMysql, setMysql, getServerStatus, setServerStatus } from '$lib/stores/connections.svelte.js';
	import { getStatus } from '$lib/api.js';

	let { user } = $props();

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/console', label: 'Console', icon: 'terminal' },
		{ href: '/players', label: 'Players', icon: 'users' },
		{ href: '/map', label: 'Map', icon: 'map' },
		{ href: '/server', label: 'Server', icon: 'server' },
		{ href: '/query', label: 'Query', icon: 'signal' },
		{ href: '/files', label: 'Files', icon: 'folder' },
		{ href: '/database', label: 'Database', icon: 'database' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	function isActive(href) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	// Poll status to keep sidebar indicators current on all pages
	async function pollStatus() {
		try {
			const result = await getStatus();
			if (result.server) setServerStatus(result.server.status || 'unknown');
			if (result.rcon) setRcon({ connected: result.rcon.connected, host: result.rcon.host || '', port: result.rcon.port || 25575 });
			if (result.mysql) setMysql({ connected: result.mysql.connected, host: result.mysql.host || '', port: result.mysql.port || 3306, database: result.mysql.gameDb || '' });
		} catch {
			// ignore — status endpoint may not be ready yet
		}
	}

	$effect(() => {
		pollStatus();
		const interval = setInterval(pollStatus, 15000);
		return () => clearInterval(interval);
	});
</script>

<aside class="w-52 bg-obsidian-950 border-r border-obsidian-800 flex flex-col h-full">

	<!-- Logo -->
	<div class="px-4 py-4 border-b border-obsidian-800">
		<div class="flex items-center gap-2.5">
			<img src="/logo.svg" alt="NetherDeck" class="h-7 w-7 logo-glow" />
			<div>
				<h1 class="text-sm font-bold text-purple-400 leading-none">NetherDeck</h1>
				<p class="text-[10px] text-obsidian-500 mt-0.5 leading-none">Web Portal</p>
			</div>
		</div>
	</div>

	<!-- Nav -->
	<nav class="flex-1 py-2 overflow-y-auto space-y-0.5 px-2">
		{#each navItems as item}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
					{active
						? 'bg-purple-500/15 text-purple-300'
						: 'text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-800/50'}"
			>
				<span class="w-[18px] h-[18px] flex items-center justify-center shrink-0 transition-colors
					{active ? 'text-purple-400' : 'text-obsidian-500 group-hover:text-obsidian-300'}">
					{#if item.icon === 'dashboard'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>
					{:else if item.icon === 'terminal'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path fill-rule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" clip-rule="evenodd"/></svg>
					{:else if item.icon === 'users'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7.5 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z"/></svg>
					{:else if item.icon === 'server'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path d="M4.632 3.533A2 2 0 016.577 2h6.846a2 2 0 011.945 1.533l1.976 8.234A3.489 3.489 0 0016 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234z"/><path fill-rule="evenodd" d="M4 13a2 2 0 100 4h12a2 2 0 100-4H4zm11.24 2a.75.75 0 01.75-.75H16a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75V15zm-2.25-.75a.75.75 0 00-.75.75v.01c0 .414.336.75.75.75H13a.75.75 0 00.75-.75V15a.75.75 0 00-.75-.75h-.01z" clip-rule="evenodd"/></svg>
					{:else if item.icon === 'signal'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm-11.23-3.435a.75.75 0 00.726.564H9.75a.75.75 0 000-1.5H7.318l.31-.31A5.5 5.5 0 0116.83 9.11a.75.75 0 101.45-.388A7 7 0 006.396 5.403l-.312.311V3.283a.75.75 0 00-1.5 0v4.243a.75.75 0 00.198.463z"/></svg>
					{:else if item.icon === 'folder'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z"/></svg>
					{:else if item.icon === 'database'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/></svg>
					{:else if item.icon === 'map'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path fill-rule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.251v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.083-1.69A1.5 1.5 0 0018 14.748V3.872a1.5 1.5 0 00-2.073-1.386l-3.51 1.452-4.26-1.763zM7.58 5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 017.58 5zm5.59 2.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5z" clip-rule="evenodd"/></svg>
					{:else if item.icon === 'settings'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-[17px] h-[17px]"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
					{/if}
				</span>
				<span class="font-medium">{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Status indicators -->
	<div class="px-3 py-3 border-t border-obsidian-800 space-y-1.5">
		{#each [
			{ label: 'Server', status: getServerStatus() === 'running' ? 'connected' : getServerStatus() === 'stopped' ? 'disconnected' : 'connecting' },
			{ label: 'RCON',   status: getRcon().connected ? 'connected' : 'disconnected' },
			{ label: 'DB',     status: getMysql().connected ? 'connected' : 'disconnected' }
		] as row}
			<div class="flex items-center justify-between px-1">
				<span class="text-[11px] text-obsidian-500">{row.label}</span>
				<span class="flex items-center gap-1.5 text-[11px]
					{row.status === 'connected' ? 'text-emerald-400' : row.status === 'connecting' ? 'text-amber-400' : 'text-rose-400'}">
					<span class="w-1.5 h-1.5 rounded-full
						{row.status === 'connected' ? 'bg-emerald-400' : row.status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}">
					</span>
					{row.status === 'connected' ? 'OK' : row.status === 'connecting' ? '…' : 'Off'}
				</span>
			</div>
		{/each}
	</div>

	<!-- User / logout -->
	<div class="px-3 py-3 border-t border-obsidian-800 flex items-center justify-between">
		<div class="flex items-center gap-2 min-w-0">
			<div class="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
				<span class="text-[10px] font-bold text-purple-400 uppercase">{(user?.username || '?')[0]}</span>
			</div>
			<span class="text-xs text-obsidian-300 truncate">{user?.username || 'Unknown'}</span>
		</div>
		<form method="POST" action="/login?/logout">
			<button type="submit" class="p-1.5 rounded-md text-obsidian-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Logout">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
					<path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clip-rule="evenodd"/>
					<path fill-rule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.007a.75.75 0 10-1.004-1.117l-2.5 2.25a.75.75 0 000 1.117l2.5 2.25a.75.75 0 101.004-1.117l-1.048-1.007h9.546A.75.75 0 0019 10z" clip-rule="evenodd"/>
				</svg>
			</button>
		</form>
	</div>

</aside>
