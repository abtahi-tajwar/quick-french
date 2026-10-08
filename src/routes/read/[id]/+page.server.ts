import { error, fail, redirect } from '@sveltejs/kit';
import { SegmentError } from '#lib/server/openai';
import {
	getDocument,
	loadSegment,
	removeDocument,
	segmentDocumentPage
} from '#lib/server/readings';
import type { Actions, PageServerLoad } from './$types';

const notices: Record<string, string> = {
	openai: 'The page is saved, but OpenAI could not segment it. Try again.',
	notext: 'This page has no selectable text. A scan without a text layer cannot be segmented.',
	nokey: 'Add OPENAI_API_KEY to .env, then segment this page.',
	pdf: 'The PDF was saved, but that page could not be read.'
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		return {
			document: { id: params.id, filename: 'PDF', page_count: 1, created_at: '' },
			page: 1,
			phrases: [],
			sourceText: '',
			notice: ''
		};
	}
	const document = await getDocument(locals.user.id, params.id);
	if (!document) error(404, 'Unknown document');

	const requested = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isInteger(requested)
		? Math.min(Math.max(requested, 1), document.page_count)
		: 1;
	const segment = await loadSegment(document.id, page);
	const code = url.searchParams.get('error') ?? '';

	return {
		document,
		page,
		phrases: segment?.phrases ?? [],
		sourceText: segment?.sourceText ?? '',
		notice: notices[code] ?? ''
	};
};

export const actions: Actions = {
	segment: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const page = Number(form.get('page'));
		try {
			await segmentDocumentPage(locals.user.id, params.id, page);
		} catch (cause) {
			const message =
				cause instanceof SegmentError ? cause.message : 'Could not segment that page.';
			return fail(400, { message });
		}
		return { segmented: true };
	},
	remove: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		try {
			await removeDocument(locals.user.id, params.id);
		} catch (cause) {
			const message = cause instanceof SegmentError ? cause.message : 'Could not delete that PDF.';
			return fail(400, { message });
		}
		redirect(303, '/read');
	}
};
