export type Phrase = {
	id: string;
	french: string;
	english: string;
	paragraph: number;
	heading: boolean;
};

export function asPhrases(value: unknown): Phrase[] {
	if (!Array.isArray(value)) return [];
	const phrases: Phrase[] = [];
	let paragraph = 1;
	for (const [index, item] of value.entries()) {
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		const french = typeof record.french === 'string' ? record.french.trim() : '';
		const english = typeof record.english === 'string' ? record.english.trim() : '';
		if (!french || !english) continue;
		const id = typeof record.id === 'string' && record.id ? record.id : `p${index + 1}`;
		const numbered =
			typeof record.paragraph === 'number' && record.paragraph > 0
				? Math.floor(record.paragraph)
				: null;
		const previous = phrases.at(-1);
		if (numbered !== null) paragraph = numbered;
		else if (previous && /[.!?…]["»)]*$/.test(previous.french)) paragraph += 1;
		phrases.push({
			id,
			french,
			english,
			paragraph,
			heading: record.heading === true
		});
	}
	return phrases;
}
