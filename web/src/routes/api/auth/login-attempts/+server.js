import { json } from '@sveltejs/kit';
import { getLoginAttempts, getLoginAttemptsSummary } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	try {
		const mode = url.searchParams.get('mode') || 'summary';

		if (mode === 'full') {
			const limit = parseInt(url.searchParams.get('limit') || '50', 10);
			const offset = parseInt(url.searchParams.get('offset') || '0', 10);
			const result = await getLoginAttempts({ limit, offset });

			return json({
				success: true,
				attempts: result.attempts,
				total: result.total,
				limit,
				offset
			});
		}

		const summary = await getLoginAttemptsSummary();
		return json({ success: true, ...summary });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
