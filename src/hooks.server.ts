import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, readSession } from '#lib/server/auth';
import { isConfigured } from '#lib/server/supabase';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.configured = isConfigured();
	event.locals.dbError = null;

	if (event.locals.configured) {
		const session = await readSession(event.cookies.get(SESSION_COOKIE));
		event.locals.user = session.user;
		event.locals.dbError = session.dbError;
	}

	if (!event.locals.configured || event.locals.dbError) {
		return resolve(event);
	}

	const path = event.url.pathname;
	if (!event.locals.user && path !== '/login') {
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ message: 'Sign in first.' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		redirect(303, '/login');
	}

	if (event.locals.user && path === '/login') {
		redirect(303, '/');
	}

	return resolve(event);
};
