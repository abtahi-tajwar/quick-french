import { dev } from '$app/env';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Cookies } from '@sveltejs/kit';
import { db, dbFailureMessage } from '#lib/server/supabase';

export const SESSION_COOKIE = 'qf_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !dev,
		maxAge: SESSION_MS / 1000
	};
}

export async function readSession(token: string | undefined) {
	if (!token) return { user: null, dbError: null };
	const client = db();
	if (!client) return { user: null, dbError: null };

	const { data, error } = await client
		.from('sessions')
		.select('user_id, expires_at')
		.eq('token_hash', hashToken(token))
		.maybeSingle();

	if (error) {
		console.error(error.message);
		return { user: null, dbError: dbFailureMessage(error.message) };
	}
	if (!data) return { user: null, dbError: null };

	if (new Date(data.expires_at).getTime() <= Date.now()) {
		await client.from('sessions').delete().eq('token_hash', hashToken(token));
		return { user: null, dbError: null };
	}

	const userResult = await client
		.from('users')
		.select('id, username')
		.eq('id', data.user_id)
		.maybeSingle();

	if (userResult.error) {
		console.error(userResult.error.message);
		return { user: null, dbError: dbFailureMessage(userResult.error.message) };
	}

	return { user: userResult.data, dbError: null };
}

export async function login(username: string, password: string, cookies: Cookies) {
	const name = username.trim();
	if (!name || !password) {
		return { ok: false as const, message: 'Enter your username and password.' };
	}
	if (name.length > 64 || password.length > 200) {
		return { ok: false as const, message: 'Those credentials do not match.' };
	}

	const client = db();
	if (!client) {
		return { ok: false as const, message: 'Supabase is not configured yet.' };
	}

	const { data, error } = await client
		.from('users')
		.select('id, username, password_hash')
		.eq('username', name)
		.maybeSingle();

	if (error) {
		console.error(error.message);
		return { ok: false as const, message: dbFailureMessage(error.message) };
	}

	const matches = data ? await bcrypt.compare(password, data.password_hash) : false;
	if (!data || !matches) {
		return { ok: false as const, message: 'Those credentials do not match.' };
	}

	const token = randomBytes(32).toString('base64url');
	const expires = new Date(Date.now() + SESSION_MS).toISOString();
	await client.from('sessions').delete().lt('expires_at', new Date().toISOString());
	const inserted = await client.from('sessions').insert({
		user_id: data.id,
		token_hash: hashToken(token),
		expires_at: expires
	});

	if (inserted.error) {
		console.error(inserted.error.message);
		return { ok: false as const, message: dbFailureMessage(inserted.error.message) };
	}

	cookies.set(SESSION_COOKIE, token, cookieOptions());
	return { ok: true as const };
}

export async function logout(token: string | undefined, cookies: Cookies) {
	const client = db();
	if (client && token) {
		await client.from('sessions').delete().eq('token_hash', hashToken(token));
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
