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

const instructions = `You prepare one PDF page for someone learning French.

The french field is always French. The english field is always English.
If the page is already French, copy that French into french, repairing only PDF spacing and line-break hyphenation, and put the English translation in english.
If the page is English or any other language, translate it. french is the French translation. english is the original wording rewritten as clear English. Never leave English in french.

Split the page into the smallest group that still has a meaning. Each french segment is 1, 2, or 3 words. Never a whole line or clause.
Use one word when that word means something by itself, such as a noun, verb, adjective, or adverb.
Use two or three words only when a word needs the words around it: an article or preposition stays with the word it serves, and a fixed expression stays together. Examples: "les inventeurs", "de créer", "au moins", "Grèce antique". Split anything longer, so "de la Grèce antique" becomes "de la" and "Grèce antique".
The english field is the meaning of that small segment only.
Cover the page in reading order. Do not summarize, skip sentences, or add commentary.
Give every phrase a paragraph number starting at 1. A paragraph holds several sentences that belong together, and every segment in that paragraph shares one number. Do not start a new paragraph at each sentence or PDF line. A heading is its own paragraph with heading true. Body text has heading false.`;

function frenchSignal(text: string) {
	const sample = text.toLowerCase();
	const accents = sample.match(/[àâäéèêëïîôùûüçœæ]/g)?.length ?? 0;
	const words =
		sample.match(
			/\b(le|la|les|des|une|un|est|sont|dans|pour|avec|que|qui|pas|vous|nous|cette|ces|aux|du|au|et|en|sur|par|comme|de|ne|se|ce|il|elle|ont|été|être|leur|ses)\b/g
		)?.length ?? 0;
	return accents + words;
}

function wordCount(french: string) {
	return french
		.replace(/[«»"'.,;:!?()[\]…—–-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length;
}

async function requestSegmentation(text: string, correction: string) {
	const apiKey = OPENAI_API_KEY;
	const model = OPENAI_MODEL;
	let response: Response;
	try {
		response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			signal: AbortSignal.timeout(90_000),
			body: JSON.stringify({
				model,
				temperature: 0.2,
				max_completion_tokens: 16000,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'phrase_segmentation', strict: true, schema }
				},
				messages: [
					{ role: 'system', content: instructions },
					{
						role: 'user',
						content: `${correction}Page text:\n${text}`
					}
				]
			})
		});
	} catch (error) {
		console.error(error);
		throw new SegmentError('OpenAI did not respond. Try this page again.', 'openai');
	}

	if (!response.ok) {
		const detail = await response.text();
		console.error(response.status, detail.slice(0, 500));
		if (response.status === 401) {
			throw new SegmentError('OpenAI rejected the API key.', 'nokey');
		}
		if (response.status === 429) {
			throw new SegmentError(
				'OpenAI is rate limiting requests. Wait a moment and try again.',
				'openai'
			);
		}
		throw new SegmentError('OpenAI could not segment this page.', 'openai');
	}

	const payload = (await response.json()) as {
		choices?: { message?: { content?: string | null } }[];
	};
	const content = payload.choices?.[0]?.message?.content;
	if (!content) throw new SegmentError('OpenAI returned an empty segmentation.', 'openai');

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new SegmentError('OpenAI returned a segmentation that was not JSON.', 'openai');
	}

	return asPhrases(
		parsed && typeof parsed === 'object' && 'phrases' in parsed
			? (parsed as { phrases: unknown }).phrases
			: null
	).slice(0, 900);
}

export async function segmentFrench(pageText: string): Promise<Phrase[]> {
	const text = pageText.slice(0, 12000);
	if (text.trim().length < 2) {
		throw new SegmentError(
			'This page has no selectable text. A scan without a text layer cannot be segmented.',
			'notext'
		);
	}

	if (!OPENAI_API_KEY) {
		throw new SegmentError('Add OPENAI_API_KEY to .env, then segment this page.', 'nokey');
	}

	let phrases = await requestSegmentation(text, '');
	const sourceIsFrench = frenchSignal(text) >= 8;
	const joined = () => phrases.map((phrase) => phrase.french).join(' ');
	const needsFrench = !sourceIsFrench && frenchSignal(joined()) < 8;
	const needsShorter = phrases.some((phrase) => wordCount(phrase.french) > 3);
	if (needsFrench || needsShorter) {
		const notes = [
			needsFrench ? 'The french field must be a French translation. Do not copy the English.' : '',
			needsShorter
				? 'Each french segment must be 1 to 3 words. Split every longer segment. A word that stands alone stays alone. Attach a word only when it has no meaning by itself.'
				: ''
		]
			.filter(Boolean)
			.join(' ');
		phrases = await requestSegmentation(text, `${notes}\n\n`);
	}

	if (!phrases.length) {
		throw new SegmentError('OpenAI did not find any phrases on this page.', 'openai');
	}
	if (!sourceIsFrench && frenchSignal(joined()) < 8) {
		throw new SegmentError(
			'The model returned English instead of a French translation. Segment this page again.',
			'openai'
		);
	}
	if (phrases.some((phrase) => wordCount(phrase.french) > 3)) {
		throw new SegmentError(
			'The segments were still longer than three words. Segment this page again.',
			'openai'
		);
	}
	return phrases;
}
