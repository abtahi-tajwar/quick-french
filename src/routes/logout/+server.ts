import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, logout } from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	await logout(cookies.get(SESSION_COOKIE), cookies);
	redirect(303, '/login');
};
