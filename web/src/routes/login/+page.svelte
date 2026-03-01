<script>
	import { enhance } from '$app/forms';

	let apiKey = $state('');
	let errorMsg = $state('');
	let loading = $state(false);
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-950 p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-indigo-400">DUITS MC RMM</h1>
			<p class="text-gray-400 mt-2">Web Management Portal</p>
		</div>

		<div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
			<h2 class="text-lg font-semibold text-gray-100 mb-4">Sign In</h2>

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
						}
					};
				}}
			>
				<div class="mb-4">
					<label for="apiKey" class="block text-sm font-medium text-gray-300 mb-1.5">
						API Key
					</label>
					<input
						type="password"
						id="apiKey"
						name="apiKey"
						bind:value={apiKey}
						required
						placeholder="Enter your agent API key"
						class="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
					/>
				</div>

				<button
					type="submit"
					disabled={loading || !apiKey}
					class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
				>
					{loading ? 'Authenticating...' : 'Sign In'}
				</button>
			</form>

			<p class="mt-4 text-xs text-gray-500 text-center">
				Enter the API key configured in your server's environment variables.
			</p>
		</div>
	</div>
</div>
