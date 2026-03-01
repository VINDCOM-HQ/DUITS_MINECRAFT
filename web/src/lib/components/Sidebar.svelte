<script>
	import { page } from '$app/state';
	import StatusIndicator from './StatusIndicator.svelte';
	import { getRcon, getSmb, getMysql, getAgentOnline } from '$lib/stores/connections.svelte.js';

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '&#9632;' },
		{ href: '/console', label: 'Console', icon: '&gt;_' },
		{ href: '/players', label: 'Players', icon: '&#9823;' },
		{ href: '/server', label: 'Server', icon: '&#9881;' },
		{ href: '/query', label: 'Query', icon: '&#8635;' },
		{ href: '/files', label: 'Files', icon: '&#128193;' },
		{ href: '/database', label: 'Database', icon: '&#128451;' },
		{ href: '/settings', label: 'Settings', icon: '&#9881;' }
	];

	function isActive(href) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<aside class="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
	<div class="px-4 py-5 border-b border-slate-800">
		<h1 class="text-lg font-bold text-indigo-400">DUITS MC RMM</h1>
		<p class="text-xs text-gray-400 mt-1">Web Portal</p>
	</div>

	<nav class="flex-1 py-3 overflow-y-auto">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors {isActive(item.href)
					? 'bg-slate-800 text-indigo-400 border-r-2 border-indigo-400'
					: 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'}"
			>
				<span class="text-base w-5 text-center">{@html item.icon}</span>
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>

	<div class="px-4 py-4 border-t border-slate-800 space-y-2">
		<StatusIndicator
			status={getAgentOnline() ? 'connected' : 'disconnected'}
			label="Agent"
		/>
		<StatusIndicator
			status={getRcon().connected ? 'connected' : 'disconnected'}
			label="RCON"
		/>
		<StatusIndicator
			status={getSmb().connected ? 'connected' : 'disconnected'}
			label="Storage"
		/>
		<StatusIndicator
			status={getMysql().connected ? 'connected' : 'disconnected'}
			label="Database"
		/>
	</div>

	<div class="px-4 py-3 border-t border-slate-800">
		<form method="POST" action="/login?/logout">
			<button
				type="submit"
				class="text-xs text-gray-400 hover:text-rose-400 transition-colors"
			>
				Logout
			</button>
		</form>
	</div>
</aside>
