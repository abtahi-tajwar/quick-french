import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';

function loadEnv(path) {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const index = trimmed.indexOf('=');
		if (index < 0) continue;
		const key = trimmed.slice(0, index).trim();
		let value = trimmed.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadEnv('.env');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const username = process.env.SEED_USERNAME?.trim();
const password = process.env.SEED_PASSWORD;

if (!url || !key || !username || !password) {
	console.error(
		'Copy .env.example to .env and set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USERNAME, and SEED_PASSWORD.'
	);
	process.exit(1);
}

const supabase = createClient(url, key, {
	auth: { persistSession: false, autoRefreshToken: false }
});

const seed = JSON.parse(readFileSync('data/words.json', 'utf8'));
const words = seed.words;
const batchSize = 400;

for (let index = 0; index < words.length; index += batchSize) {
	const batch = words.slice(index, index + batchSize);
	const { error } = await supabase.from('words').upsert(batch, { onConflict: 'lemma,pos' });
	if (error) {
		console.error(error.message);
		if (/does not exist|schema cache/i.test(error.message)) {
			console.error('Run supabase/schema.sql in the Supabase SQL editor, then seed again.');
		}
		if (/row-level security|permission denied/i.test(error.message)) {
			console.error('Use the service role key, not the anon key.');
		}
		process.exit(1);
	}
	console.log(`words ${Math.min(index + batchSize, words.length)} / ${words.length}`);
}

const passwordHash = await bcrypt.hash(password, 10);
const { error: userError } = await supabase
	.from('users')
	.upsert({ username, password_hash: passwordHash }, { onConflict: 'username' });

if (userError) {
	console.error(userError.message);
	process.exit(1);
}

console.log(`Account ready: ${username}`);
console.log('Vocabulary license: CC BY-NC-SA 4.0 (FLELex / Beacco + MUSE glosses).');
