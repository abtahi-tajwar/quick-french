import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '#lib/server/settings';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isConfigured() {
	return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function db() {
	const url = SUPABASE_URL;
	const key = SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return null;
	if (!client) {
		client = createClient(url, key, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
	}
	return client;
}

export function dbFailureMessage(message: string) {
	if (/does not exist|schema cache|42P01/i.test(message)) {
		return 'The tables are not in Supabase yet. Run supabase/schema.sql, then npm run seed.';
	}
	if (/row-level security|42501|permission denied/i.test(message)) {
		return 'That key cannot use the tables. Use the service role key, not the anon key.';
	}
	if (/Invalid API key|JWT|invalid api key/i.test(message)) {
		return 'Supabase rejected the service role key.';
	}
	return 'Could not reach Supabase. Check SUPABASE_URL and the service role key.';
}
