import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { EmptyReason, GradeOption, StudyPayload } from '#lib/cards';
import { studyDay } from '#lib/dates';
import { formatInterval } from '#lib/format';
import { isDeck, isLevel, type Deck } from '#lib/levels';
import { posLabel } from '#lib/pos';
import { needsWork } from '#lib/progress';
import { DAILY_NEW_LIMIT, REQUEST_RETENTION } from '#lib/study-config';
import { db } from '#lib/server/supabase';

const scheduler = fsrs(
	generatorParameters({
		request_retention: REQUEST_RETENTION,
		maximum_interval: 365,
		enable_fuzz: false,
		enable_short_term: true
	})
);

const CARD_SELECT =
	'word_id, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, introduced_on, words!inner(lemma, pos, level, translation, frequency_rank)';

type WordEmbed = {
	lemma: string;
	pos: string;
	level: string;
	translation: string;
	frequency_rank: number;
};

type CardRow = {
	word_id: string;
	due: string;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	state: number;
	last_review: string | null;
	introduced_on: string;
	words: WordEmbed | WordEmbed[];
};

type FreshWord = WordEmbed & { id: string };

export class StudyError extends Error {}

function database() {
	const client = db();
	if (!client) throw new StudyError('Supabase is not configured.');
	return client;
}

function asGrade(rating: number): Grade {
	if (
		rating === Rating.Again ||
		rating === Rating.Hard ||
		rating === Rating.Good ||
		rating === Rating.Easy
	) {
		return rating;
	}
	throw new StudyError('Choose Again, Hard, Good, or Easy.');
}

function embed(value: WordEmbed | WordEmbed[]) {
	const word = Array.isArray(value) ? value[0] : value;
	if (!word) throw new StudyError('That card is missing its word.');
	return word;
}

function toCard(row: CardRow): Card {
	return {
		due: new Date(row.due),
		stability: row.stability,
		difficulty: row.difficulty,
		elapsed_days: row.elapsed_days,
		scheduled_days: row.scheduled_days,
		learning_steps: row.learning_steps,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		...(row.last_review ? { last_review: new Date(row.last_review) } : {})
	};
}

function cardFields(card: Card, introducedOn?: string) {
	return {
		due: card.due.toISOString(),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsed_days: Math.round(card.elapsed_days),
		scheduled_days: Math.round(card.scheduled_days),
		learning_steps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		last_review: card.last_review ? card.last_review.toISOString() : null,
		...(introducedOn ? { introduced_on: introducedOn } : {})
	};
}

const GRADE_LABELS: Record<Grade, GradeOption['label']> = {
	[Rating.Again]: 'Again',
	[Rating.Hard]: 'Hard',
	[Rating.Good]: 'Good',
	[Rating.Easy]: 'Easy'
};

function gradesFor(card: Card, now: Date): GradeOption[] {
	const preview = scheduler.repeat(card, now);
	return ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const).map((rating) => ({
		rating,
		label: GRADE_LABELS[rating],
		interval: formatInterval(now, preview[rating].card.due)
	}));
}

function present(row: CardRow, now = new Date()): StudyPayload {
	const word = embed(row.words);
	const card = toCard(row);
	let retrievability: number | null = null;
	if (card.reps > 0 && card.stability > 0) {
		const value = scheduler.get_retrievability(card, now, false);
		if (typeof value === 'number' && Number.isFinite(value)) {
			retrievability = Math.min(1, Math.max(0, value));
		}
	}
	return {
		card: {
			wordId: row.word_id,
			lemma: word.lemma,
			translation: word.translation,
			posLabel: posLabel(word.pos),
			level: word.level,
			lapses: card.lapses,
			retrievability
		},
		grades: gradesFor(card, now),
		emptyReason: null,
		nextDue: null
	};
}

async function nextDue(userId: string, deck: Deck) {
	let query = database()
		.from('card_states')
		.select('due, words!inner(level)')
		.eq('user_id', userId)
		.gt('due', new Date().toISOString())
		.order('due', { ascending: true })
		.limit(1);
	if (isLevel(deck)) query = query.eq('words.level', deck);
	const { data, error } = await query;
	if (error) {
		console.error(error.message);
		return null;
	}
	const row = data?.[0] as { due: string } | undefined;
	return row?.due ?? null;
}

async function empty(userId: string, deck: Deck, reason: EmptyReason): Promise<StudyPayload> {
	return {
		card: null,
		grades: [],
		emptyReason: reason,
		nextDue: await nextDue(userId, deck)
	};
}

async function findStates(userId: string, deck: Deck, states: number[], excludeWordId?: string) {
	let query = database()
		.from('card_states')
		.select(CARD_SELECT)
		.eq('user_id', userId)
		.in('state', states)
		.lte('due', new Date().toISOString())
		.order('due', { ascending: true })
		.limit(8);
	if (isLevel(deck)) query = query.eq('words.level', deck);
	const { data, error } = await query;
	if (error) {
		console.error(error.message);
		throw new StudyError('Could not load the next card.');
	}
	return ((data ?? []) as CardRow[]).find((row) => row.word_id !== excludeWordId) ?? null;
}

async function findDue(userId: string, deck: Deck, excludeWordId?: string) {
	for (const states of [[1, 3], [0], [2]]) {
		const row = await findStates(userId, deck, states, excludeWordId);
		if (row) return row;
	}
	return null;
}

async function findPractice(userId: string, excludeWordId?: string) {
	const { data, error } = await database()
		.from('card_states')
		.select(CARD_SELECT)
		.eq('user_id', userId)
		.or('state.eq.1,state.eq.3,lapses.gte.1')
		.order('last_review', { ascending: true, nullsFirst: true })
		.limit(80);
	if (error) {
		console.error(error.message);
		throw new StudyError('Could not load the next card.');
	}
	return (
		((data ?? []) as CardRow[]).find((row) => row.word_id !== excludeWordId && needsWork(row)) ??
		null
	);
}

async function introducedToday(userId: string) {
	const { count, error } = await database()
		.from('card_states')
		.select('word_id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.eq('introduced_on', studyDay());
	if (error) {
		console.error(error.message);
		throw new StudyError('Could not check today’s new-word limit.');
	}
	return count ?? 0;
}

async function findNewWord(userId: string, level: string): Promise<FreshWord | null> {
	const pageSize = 40;
	for (let offset = 0; offset < 5000; offset += pageSize) {
		const { data, error } = await database()
			.from('words')
			.select('id, lemma, pos, level, translation, frequency_rank')
			.eq('level', level)
			.order('frequency_rank', { ascending: true })
			.range(offset, offset + pageSize - 1);
		if (error) {
			console.error(error.message);
			throw new StudyError('Could not load a new word.');
		}
		const words = (data ?? []) as FreshWord[];
		if (!words.length) return null;
		const existing = await database()
			.from('card_states')
			.select('word_id')
			.eq('user_id', userId)
			.in(
				'word_id',
				words.map((word) => word.id)
			);
		if (existing.error) {
			console.error(existing.error.message);
			throw new StudyError('Could not load a new word.');
		}
		const seen = new Set((existing.data ?? []).map((row) => row.word_id as string));
		const fresh = words.find((word) => !seen.has(word.id));
		if (fresh) return fresh;
	}
	return null;
}

async function wordCount(level: string) {
	const { count, error } = await database()
		.from('words')
		.select('id', { count: 'exact', head: true })
		.eq('level', level);
	if (error) return 0;
	return count ?? 0;
}

async function introduce(userId: string, word: FreshWord, now: Date) {
	const emptyCard = createEmptyCard(now);
	const today = studyDay(now);
	const inserted = await database()
		.from('card_states')
		.insert({
			user_id: userId,
			word_id: word.id,
			introduced_on: today,
			...cardFields(emptyCard)
		});
	if (inserted.error) {
		if (inserted.error.code === '23505') {
			const existing = await getCard(userId, word.id);
			if (existing) return existing;
		}
		console.error(inserted.error.message);
		throw new StudyError('Could not add that word to your deck.');
	}
	const row: CardRow = {
		word_id: word.id,
		introduced_on: today,
		...cardFields(emptyCard),
		words: word
	};
	return row;
}

async function getCard(userId: string, wordId: string) {
	const { data, error } = await database()
		.from('card_states')
		.select(CARD_SELECT)
		.eq('user_id', userId)
		.eq('word_id', wordId)
		.maybeSingle();
	if (error) {
		console.error(error.message);
		throw new StudyError('Could not load that card.');
	}
	return (data as CardRow | null) ?? null;
}

/**
 * Queue order matches a standard FSRS / Anki session:
 * due learning and relearning cards, then new cards already started,
 * then due reviews, then fresh words up to the daily limit, most frequent first.
 */
export async function getNextCard(
	userId: string,
	deck: Deck,
	excludeWordId?: string
): Promise<StudyPayload> {
	if (!isDeck(deck)) throw new StudyError('Unknown deck.');

	if (deck === 'practice') {
		const row = await findPractice(userId, excludeWordId);
		return row ? present(row) : empty(userId, deck, 'clear');
	}

	const due = await findDue(userId, deck, excludeWordId);
	if (due) return present(due);

	if (deck === 'due') return empty(userId, deck, 'caught_up');

	if ((await introducedToday(userId)) >= DAILY_NEW_LIMIT) {
		return empty(userId, deck, 'quota');
	}

	const fresh = await findNewWord(userId, deck);
	if (!fresh) {
		const total = await wordCount(deck);
		return empty(userId, deck, total === 0 ? 'no_words' : 'caught_up');
	}

	const now = new Date();
	const row = await introduce(userId, fresh, now);
	return present(row, now);
}

export async function rateCard(userId: string, deck: Deck, wordId: string, rating: number) {
	const grade = asGrade(rating);
	const row = await getCard(userId, wordId);
	if (!row) throw new StudyError('That card is not in your deck.');

	const now = new Date();
	const scheduled = scheduler.repeat(toCard(row), now)[grade].card;
	const updated = await database()
		.from('card_states')
		.update(cardFields(scheduled))
		.eq('user_id', userId)
		.eq('word_id', wordId);
	if (updated.error) {
		console.error(updated.error.message);
		throw new StudyError('Could not save that review.');
	}

	const logged = await database().from('review_logs').insert({
		user_id: userId,
		word_id: wordId,
		rating: grade,
		state_before: row.state,
		reviewed_at: now.toISOString()
	});
	if (logged.error) console.error(logged.error.message);

	return getNextCard(userId, deck, wordId);
}
