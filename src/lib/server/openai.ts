import { OPENAI_API_KEY, OPENAI_MODEL } from '$app/env/private';
import { asPhrases, type Phrase } from '#lib/phrases';

export class SegmentError extends Error {
	constructor(
		message: string,
		readonly code: 'openai' | 'notext' | 'nokey' | 'pdf'
	) {
		super(message);
		this.name = 'SegmentError';
	}
}

const TRANSLATION_INSTRUCTIONS = `You are a professional literary translator. Translate the source into natural French.

This is translation, not a summary, a simplification, or an adaptation.

Rules:
1. Never summarize the source.
2. Never omit, skip, compress, or merge substantive information.
3. Translate the entire input, from the first word through the last.
4. Preserve paragraph breaks and dialogue structure whenever the source has them.
5. Every source sentence must have a corresponding sentence or an equivalent construction in the French.
6. Do not invent information that is not in the source.
7. Translate by meaning and grammar. Do not map English words one by one. The French must be grammatical and idiomatic.
8. Preserve meaning, tone, narrative voice, tense, and level of formality.
9. Preserve names, places, titles, technical terms, quotations, and who is speaking.
10. Do not explain the translation and do not add commentary. Return only the French text.
11. Do not stop early because the input is long.
12. Keep quotation marks and the speaker structure of dialogue.
13. Omit standalone page numbers and bare URLs. Translate everything else.
14. Do not fill in content that is missing from the source.

If the source is already French, reproduce all of it. Repair only spacing and words split by a line-break hyphen. Do not shorten it and do not translate it into English.

Parenthetical asides and idioms must read as natural French. For example, "for so it will be convenient to speak of him" becomes "car c'est ainsi qu'il sera plus commode de le désigner", not a word-for-word gloss.

Before you answer, check privately that every paragraph, sentence, name, example, and line of dialogue is present, and that you did not summarize or stop early. Do not print that check.`;

const SEGMENT_INSTRUCTIONS = `You split a finished French text into short pieces for a learner. You do not rewrite it.

Copy the French in order, including commas, periods, question marks, and quotation marks, attached to the word they belong to. Do not omit, summarize, reorder, or improve a word. Joining the french fields with spaces must recreate the input.
Each french piece is 1, 2, or 3 words. Keep a word alone when it stands on its own. Keep two or three words together only when an article, a preposition, or a fixed expression cannot be split.
The english field is the natural English meaning of that small piece only, not a translation of a whole sentence.
Give pieces from the same paragraph the same paragraph number, starting at 1. Do not start a new paragraph at every sentence. A heading is its own paragraph with heading true. Body text has heading false.
Do not add commentary.`;

const schema = {
	type: 'object',
	additionalProperties: false,
	required: ['phrases'],
	properties: {
		phrases: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['french', 'english', 'paragraph', 'heading'],
				properties: {
					french: { type: 'string' },
					english: { type: 'string' },
					paragraph: { type: 'integer' },
					heading: { type: 'boolean' }
				}
			}
		}
	}
} as const;

const TRANSLATION_CHUNK = 1800;
const SEGMENT_CHUNK = 1400;

function frenchSignal(text: string) {
	const sample = text.toLowerCase();
	const accents = sample.match(/[àâäéèêëïîôùûüçœæ]/g)?.length ?? 0;
	const words =
		sample.match(
			/\b(le|la|les|des|une|un|est|sont|dans|pour|avec|que|qui|pas|vous|nous|cette|ces|aux|du|au|et|en|sur|par|comme|de|ne|se|ce|il|elle|ont|été|être|leur|ses)\b/g
		)?.length ?? 0;
	return accents + words;
}

function wordCount(text: string) {
	return text
		.replace(/[«»"'“”„.,;:!?()[\]…—–-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length;
}

function sentenceCount(text: string) {
	return text
		.split(/[.!?]+/)
		.map((part) => part.trim())
		.filter((part) => wordCount(part) >= 4).length;
}

function isArtifact(paragraph: string) {
	return /^\d{1,4}$/.test(paragraph) || /^https?:\/\/\S+$/.test(paragraph);
}

export function prepareSource(text: string) {
	const unwrapped = text
		.replaceAll('\u0000', '')
		.replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
		.replace(/[ \t]+\n/g, '\n');
	return unwrapped
		.split(/\n{2,}/)
		.map((paragraph) =>
			paragraph
				.replace(/\n/g, ' ')
				.replace(/[ \t]{2,}/g, ' ')
				.trim()
		)
		.filter((paragraph) => paragraph && !isArtifact(paragraph))
		.join('\n\n');
}

function splitInHalf(text: string): [string, string] {
	const mid = Math.floor(text.length / 2);
	const marks = ['\n\n', '. ', '? ', '! ', ' '];
	for (const mark of marks) {
		const at = text.lastIndexOf(mark, mid + 240);
		if (at > text.length * 0.2) {
			const cut = at + mark.length;
			return [text.slice(0, cut).trim(), text.slice(cut).trim()];
		}
	}
	return [text.trim(), ''];
}

export function packChunks(text: string, limit: number) {
	const chunks: string[] = [];
	let current = '';

	const pushLong = (part: string) => {
		if (part.length <= limit) {
			chunks.push(part);
			return;
		}
		const [left, right] = splitInHalf(part);
		if (!right) {
			chunks.push(left);
			return;
		}
		pushLong(left);
		pushLong(right);
	};

	for (const paragraph of text.split(/\n\n/)) {
		const piece = paragraph.trim();
		if (!piece) continue;
		if (!current) {
			if (piece.length > limit) pushLong(piece);
			else current = piece;
			continue;
		}
		if (current.length + 2 + piece.length <= limit) current = `${current}\n\n${piece}`;
		else {
			chunks.push(current);
			current = '';
			if (piece.length > limit) pushLong(piece);
			else current = piece;
		}
	}
	if (current) chunks.push(current);
	return chunks;
}

function cleanTranslation(text: string) {
	return text
		.replace(/^\s*(traduction|translation)\s*:\s*/i, '')
		.replace(/^```[a-z]*\n?/i, '')
		.replace(/\n?```$/i, '')
		.trim();
}

function tooShort(source: string, translation: string) {
	const sourceSentences = sentenceCount(source);
	const translatedSentences = sentenceCount(translation);
	if (sourceSentences >= 2 && translatedSentences < Math.ceil(sourceSentences * 0.8)) return true;
	const sourceChars = source.replace(/\s/g, '').length;
	const translatedChars = translation.replace(/\s/g, '').length;
	return sourceChars > 240 && translatedChars < sourceChars * 0.55;
}

function tokenList(text: string) {
	return text
		.toLowerCase()
		.replace(/[’‘]/g, "'")
		.replace(/[«»"'“”„.,;:!?()[\]…—–-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
}

function covers(source: string, output: string) {
	const expected = tokenList(source);
	if (!expected.length) return 1;
	const actual = tokenList(output);
	let index = 0;
	for (const token of actual) {
		if (token === expected[index]) index += 1;
		if (index >= expected.length) break;
	}
	return index / expected.length;
}

type ChatMessage = { role: 'system' | 'user'; content: string };

async function chat(messages: ChatMessage[], maxTokens: number, json: boolean) {
	let response: Response;
	try {
		response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			signal: AbortSignal.timeout(90_000),
			body: JSON.stringify({
				model: OPENAI_MODEL,
				temperature: 0.2,
				max_completion_tokens: maxTokens,
				...(json
					? {
							response_format: {
								type: 'json_schema',
								json_schema: { name: 'phrase_segmentation', strict: true, schema }
							}
						}
					: {}),
				messages
			})
		});
	} catch (error) {
		console.error(error);
		throw new SegmentError('OpenAI did not respond. Try this page again.', 'openai');
	}

	if (!response.ok) {
		const detail = await response.text();
		console.error(response.status, detail.slice(0, 500));
		if (response.status === 401) throw new SegmentError('OpenAI rejected the API key.', 'nokey');
		if (response.status === 429) {
			throw new SegmentError(
				'OpenAI is rate limiting requests. Wait a moment and try again.',
				'openai'
			);
		}
		throw new SegmentError('OpenAI could not read this page.', 'openai');
	}

	const payload = (await response.json()) as {
		choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
	};
	const choice = payload.choices?.[0];
	const content = choice?.message?.content?.trim() ?? '';
	if (!content) throw new SegmentError('OpenAI returned an empty response.', 'openai');
	return { content, finish: choice?.finish_reason ?? null };
}

async function translateChunk(text: string, reminded = false): Promise<string> {
	const reminder = reminded
		? 'The previous translation omitted sentences. Translate every sentence, in order, through the end. Do not summarize.\n\n'
		: '';
	const { content, finish } = await chat(
		[
			{ role: 'system', content: TRANSLATION_INSTRUCTIONS },
			{ role: 'user', content: `${reminder}Source:\n${text}` }
		],
		4000,
		false
	);
	if (finish === 'length') {
		const [left, right] = splitInHalf(text);
		if (!right)
			throw new SegmentError('The translation stopped before the end of the page.', 'openai');
		const first = await translateChunk(left);
		const second = await translateChunk(right);
		return `${first}\n\n${second}`;
	}
	const translation = cleanTranslation(content);
	if (!reminded && tooShort(text, translation)) return translateChunk(text, true);
	if (tooShort(text, translation)) {
		throw new SegmentError(
			'The translation left out part of this page. Segment it again.',
			'openai'
		);
	}
	return translation;
}

async function segmentChunk(text: string, reminded = false): Promise<Phrase[]> {
	const reminder = reminded
		? 'You dropped French words. Copy every word, in order, and do not rewrite the French.\n\n'
		: '';
	const { content, finish } = await chat(
		[
			{ role: 'system', content: SEGMENT_INSTRUCTIONS },
			{ role: 'user', content: `${reminder}French text:\n${text}` }
		],
		8000,
		true
	);
	if (finish === 'length') {
		const [left, right] = splitInHalf(text);
		if (!right)
			throw new SegmentError('Phrase splitting stopped before the end of the page.', 'openai');
		const first = await segmentChunk(left);
		const second = await segmentChunk(right);
		const offset = first.reduce((max, phrase) => Math.max(max, phrase.paragraph), 0);
		return [
			...first,
			...second.map((phrase) => ({ ...phrase, paragraph: phrase.paragraph + offset }))
		];
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new SegmentError('OpenAI returned a segmentation that was not JSON.', 'openai');
	}
	const phrases = asPhrases(
		parsed && typeof parsed === 'object' && 'phrases' in parsed
			? (parsed as { phrases: unknown }).phrases
			: null
	);
	if (!phrases.length)
		throw new SegmentError('OpenAI did not find any phrases on this page.', 'openai');
	const joined = phrases.map((phrase) => phrase.french).join(' ');
	if (!reminded && covers(text, joined) < 0.85) return segmentChunk(text, true);
	if (covers(text, joined) < 0.85) {
		throw new SegmentError(
			'Phrase splitting left out part of the translation. Segment it again.',
			'openai'
		);
	}
	return phrases;
}

export async function segmentFrench(pageText: string): Promise<Phrase[]> {
	const text = prepareSource(pageText);
	if (text.length < 2) {
		throw new SegmentError(
			'This page has no selectable text. A scan without a text layer cannot be segmented.',
			'notext'
		);
	}
	if (!OPENAI_API_KEY) {
		throw new SegmentError('Add OPENAI_API_KEY to .env, then segment this page.', 'nokey');
	}

	const translated: string[] = [];
	for (const chunk of packChunks(text, TRANSLATION_CHUNK)) {
		translated.push(await translateChunk(chunk));
	}
	const french = translated.join('\n\n').trim();
	const sourceIsFrench = frenchSignal(text) >= 8;
	if (!sourceIsFrench && frenchSignal(french) < 8) {
		throw new SegmentError(
			'The model returned English instead of a French translation. Segment this page again.',
			'openai'
		);
	}

	const phrases: Phrase[] = [];
	let paragraphOffset = 0;
	for (const chunk of packChunks(french, SEGMENT_CHUNK)) {
		const part = await segmentChunk(chunk);
		const maxParagraph = part.reduce((max, phrase) => Math.max(max, phrase.paragraph), 0);
		phrases.push(
			...part.map((phrase) => ({ ...phrase, paragraph: phrase.paragraph + paragraphOffset }))
		);
		paragraphOffset += maxParagraph;
	}

	return phrases.map((phrase, index) => ({ ...phrase, id: `p${index + 1}` }));
}
