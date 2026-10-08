export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type Level = (typeof LEVELS)[number];
export type Deck = Level | 'due' | 'practice';

export function isLevel(value: string): value is Level {
	return (LEVELS as readonly string[]).includes(value);
}

export function isDeck(value: string): value is Deck {
	return isLevel(value) || value === 'due' || value === 'practice';
}

export const LEVEL_META: Record<Level, { blurb: string; accent: string }> = {
	A1: { blurb: 'First words', accent: 'bg-navy' },
	A2: { blurb: 'Everyday life', accent: 'bg-sea' },
	B1: { blurb: 'On your own', accent: 'bg-gold' },
	B2: { blurb: 'Nuance', accent: 'bg-coral' },
	C1: { blurb: 'Precision', accent: 'bg-ink' },
	C2: { blurb: 'Mastery', accent: 'bg-moss' }
};

export function deckTitle(deck: Deck) {
	if (deck === 'due') return 'Due reviews';
	if (deck === 'practice') return 'Needs work';
	return deck;
}

export function deckBlurb(deck: Deck) {
	if (deck === 'due') return 'Everything that is due, across all levels.';
	if (deck === 'practice') return 'Words that are still shaky.';
	return LEVEL_META[deck].blurb;
}
