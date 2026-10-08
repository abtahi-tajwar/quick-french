import { error } from '@sveltejs/kit';
import type { StudyPayload } from '#lib/cards';
import { isDeck } from '#lib/levels';
import { getNextCard } from '#lib/server/study';
import type { PageServerLoad } from './$types';

const blank: StudyPayload = { card: null, grades: [], emptyReason: null, nextDue: null };

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!isDeck(params.deck)) error(404, 'Unknown deck');
	if (!locals.user) return { deck: params.deck, study: blank };
	try {
		return { deck: params.deck, study: await getNextCard(locals.user.id, params.deck) };
	} catch (cause) {
		console.error(cause);
		error(500, 'Could not load the next card.');
	}
};
