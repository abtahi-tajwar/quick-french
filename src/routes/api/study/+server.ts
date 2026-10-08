import { json } from '@sveltejs/kit';
import { isDeck } from '#lib/levels';
import { getNextCard, rateCard, StudyError } from '#lib/server/study';
import type { RequestHandler } from './$types';

function failure(error: unknown) {
	console.error(error);
	const message = error instanceof StudyError ? error.message : 'Could not load the next card.';
	const status = error instanceof StudyError ? 400 : 500;
	return json({ message }, { status });
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return json({ message: 'Sign in first.' }, { status: 401 });
	const deck = url.searchParams.get('deck') ?? '';
	if (!isDeck(deck)) return json({ message: 'Unknown deck.' }, { status: 400 });
	try {
		return json(await getNextCard(locals.user.id, deck));
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ message: 'Sign in first.' }, { status: 401 });
	const body = (await request.json()) as { deck?: unknown; wordId?: unknown; rating?: unknown };
	if (typeof body.deck !== 'string' || !isDeck(body.deck)) {
		return json({ message: 'Unknown deck.' }, { status: 400 });
	}
	if (typeof body.wordId !== 'string' || typeof body.rating !== 'number') {
		return json({ message: 'That review could not be read.' }, { status: 400 });
	}
	try {
		return json(await rateCard(locals.user.id, body.deck, body.wordId, body.rating));
	} catch (error) {
		return failure(error);
	}
};
