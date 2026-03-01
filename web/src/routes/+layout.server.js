/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
	return {
		authenticated: locals.authenticated
	};
}
