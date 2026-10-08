import { fail, redirect } from '@sveltejs/kit';
import { login } from '#lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '');
		const password = String(form.get('password') ?? '');
		const result = await login(username, password, cookies);
		if (!result.ok) return fail(400, { message: result.message, username });
		redirect(303, '/');
	}
};
