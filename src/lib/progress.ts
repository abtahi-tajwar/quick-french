export type CardSnapshot = {
	state: number;
	stability: number;
	lapses: number;
	reps: number;
	due: string;
};

export function isMastered(card: Pick<CardSnapshot, 'state' | 'stability'>) {
	return card.state === 2 && card.stability >= 21;
}

/** Still learning, failed more than once, or a young card that was missed. */
export function needsWork(card: Pick<CardSnapshot, 'state' | 'stability' | 'lapses'>) {
	if (isMastered(card)) return false;
	return (
		card.state === 1 ||
		card.state === 3 ||
		card.lapses >= 2 ||
		(card.state === 2 && card.stability < 7 && card.lapses >= 1)
	);
}

export function isDue(card: Pick<CardSnapshot, 'due'>, now = Date.now()) {
	return new Date(card.due).getTime() <= now;
}
