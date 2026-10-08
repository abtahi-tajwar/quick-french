const POS_LABELS: Record<string, string> = {
	NOM: 'noun',
	VER: 'verb',
	ADJ: 'adjective',
	ADV: 'adverb',
	INT: 'interjection',
	KON: 'conjunction',
	PRP: 'preposition',
	'PRP:det': 'preposition',
	PRO: 'pronoun',
	'DET:ART': 'article',
	'DET:POS': 'possessive'
};

export function posLabel(pos: string) {
	return POS_LABELS[pos] ?? pos.toLowerCase();
}
