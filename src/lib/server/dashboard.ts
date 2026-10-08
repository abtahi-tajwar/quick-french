import { streakFrom } from '#lib/dates';
import { LEVELS, type Level } from '#lib/levels';
import { isDue, isMastered, needsWork } from '#lib/progress';
import { db } from '#lib/server/supabase';

export type LevelStat = {
	total: number;
	unseen: number;
	due: number;
	needsWork: number;
	mastered: number;
	practiced: number;
};

const emptyStat = (): LevelStat => ({
	total: 0,
	unseen: 0,
	due: 0,
	needsWork: 0,
	mastered: 0,
	practiced: 0
});

export async function loadDashboard(userId: string) {
	const client = db();
	if (!client) throw new Error('Supabase is not configured.');

	const [wordsResult, cardsResult, logsResult, readingsResult] = await Promise.all([
		client.from('words').select('id, level'),
		client
			.from('card_states')
			.select('word_id, state, stability, lapses, reps, due')
			.eq('user_id', userId),
		client
			.from('review_logs')
			.select('reviewed_at')
			.eq('user_id', userId)
			.order('reviewed_at', { ascending: false })
			.limit(800),
		client
			.from('documents')
			.select('id, filename, page_count, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(8)
	]);

	for (const result of [wordsResult, cardsResult, logsResult, readingsResult]) {
		if (result.error) {
			console.error(result.error.message);
			throw new Error('Could not load your study stats.');
		}
	}

	const stats = Object.fromEntries(LEVELS.map((level) => [level, emptyStat()])) as Record<
		Level,
		LevelStat
	>;
	const cards = new Map((cardsResult.data ?? []).map((card) => [card.word_id as string, card]));

	for (const word of wordsResult.data ?? []) {
		const level = word.level as Level;
		if (!stats[level]) continue;
		const stat = stats[level];
		stat.total += 1;
		const card = cards.get(word.id as string);
		if (!card) {
			stat.unseen += 1;
			continue;
		}
		if (card.reps > 0) stat.practiced += 1;
		if (isDue(card)) stat.due += 1;
		if (needsWork(card)) stat.needsWork += 1;
		if (isMastered(card)) stat.mastered += 1;
	}

	const totals = Object.values(stats).reduce((sum, stat) => {
		sum.total += stat.total;
		sum.unseen += stat.unseen;
		sum.due += stat.due;
		sum.needsWork += stat.needsWork;
		sum.mastered += stat.mastered;
		sum.practiced += stat.practiced;
		return sum;
	}, emptyStat());

	return {
		stats,
		totals,
		streak: streakFrom((logsResult.data ?? []).map((row) => row.reviewed_at as string)),
		readings: readingsResult.data ?? []
	};
}
