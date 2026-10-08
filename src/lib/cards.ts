export type GradeOption = {
	rating: 1 | 2 | 3 | 4;
	label: string;
	interval: string;
};

export type StudyCard = {
	wordId: string;
	lemma: string;
	translation: string;
	posLabel: string;
	level: string;
	lapses: number;
	retrievability: number | null;
};

export type EmptyReason = 'quota' | 'caught_up' | 'clear' | 'no_words';

export type StudyPayload = {
	card: StudyCard | null;
	grades: GradeOption[];
	emptyReason: EmptyReason | null;
	nextDue: string | null;
};
