<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	let { data } = $props();

	let username = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	// Pick up error from OAuth/SAML redirect
	$effect(() => {
		const urlError = $page.url.searchParams.get('error');
		if (urlError) {
			errorMsg = urlError;
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-obsidian-950 p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<img src="/logo.svg" alt="NetherDeck" class="h-20 w-20 mx-auto mb-4 logo-glow-hero" />
			<h1 class="text-3xl font-bold text-purple-400">NetherDeck</h1>
			<p class="text-obsidian-200 mt-2">Web Management Portal</p>
		</div>

		<div class="bg-obsidian-900 border border-obsidian-700 rounded-xl p-6 shadow-xl">
			<h2 class="text-lg font-semibold text-obsidian-100 mb-4">Sign In</h2>

			{#if errorMsg}
				<div class="bg-rose-600/20 border border-rose-500/50 text-rose-300 px-4 py-2 rounded-lg mb-4 text-sm">
					{errorMsg}
				</div>
			{/if}

			<form
				method="POST"
				action="/login?/login"
				use:enhance={() => {
					loading = true;
					errorMsg = '';
					return async ({ result }) => {
						loading = false;
						if (result.type === 'failure') {
							errorMsg = result.data?.error || 'Authentication failed';
						} else if (result.type === 'redirect') {
							window.location.href = result.location;
						} else if (result.type === 'error') {
							errorMsg = 'An unexpected error occurred. Please try again.';
						}
					};
				}}
			>
				<div class="mb-4">
					<label for="username" class="block text-sm font-medium text-obsidian-200 mb-1.5">
						Username
					</label>
					<input
						type="text"
						id="username"
						name="username"
						bind:value={username}
						required
						autocomplete="username"
						placeholder="Enter your username"
						class="w-full px-3 py-2.5 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 placeholder-obsidian-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
					/>
				</div>

				<div class="mb-4">
					<label for="password" class="block text-sm font-medium text-obsidian-200 mb-1.5">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						bind:value={password}
						required
						autocomplete="current-password"
						placeholder="Enter your password"
						class="w-full px-3 py-2.5 bg-obsidian-800 border border-obsidian-600 rounded-lg text-obsidian-100 placeholder-obsidian-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
					/>
				</div>

				<button
					type="submit"
					disabled={loading || !username || !password}
					class="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-obsidian-700 disabled:text-obsidian-300 text-white font-medium rounded-lg transition-colors"
				>
					{loading ? 'Authenticating...' : 'Sign In'}
				</button>
			</form>

			{#if data?.authMethods?.oauth || data?.authMethods?.saml}
				<div class="mt-5 pt-5 border-t border-obsidian-600">
					<p class="text-xs text-obsidian-300 text-center mb-3">or sign in with</p>
					<div class="space-y-2">
						{#if data.authMethods.oauth}
							<a
								href="/auth/oauth"
								class="flex items-center justify-center w-full py-2.5 px-4 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 text-obsidian-100 font-medium rounded-lg transition-colors text-sm"
							>
								Sign in with SSO
							</a>
						{/if}
						{#if data.authMethods.saml}
							<a
								href="/auth/saml"
								class="flex items-center justify-center w-full py-2.5 px-4 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 text-obsidian-100 font-medium rounded-lg transition-colors text-sm"
							>
								Sign in with SAML
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
