import { fail, redirect } from '@sveltejs/kit';
import { listDocuments, savePdf, segmentDocumentPage } from '#lib/server/readings';
import { SegmentError } from '#lib/server/openai';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { documents: [], listError: null };
	try {
		return { documents: await listDocuments(locals.user.id), listError: null };
	} catch (error) {
		console.error(error);
		return { documents: [], listError: 'Could not list your PDFs.' };
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const file = form.get('pdf');
		if (!(file instanceof File)) return fail(400, { message: 'Choose a PDF first.' });

		let id: string;
		let errorCode: string | null = null;
		try {
			const saved = await savePdf(locals.user.id, file);
			id = saved.id;
			try {
				await segmentDocumentPage(locals.user.id, saved.id, 1);
			} catch (error) {
				errorCode = error instanceof SegmentError ? error.code : 'openai';
			}
		} catch (error) {
			const message = error instanceof SegmentError ? error.message : 'Could not open that PDF.';
			return fail(400, { message });
		}

		const target = errorCode ? `/read/${id}?page=1&error=${errorCode}` : `/read/${id}?page=1`;
		redirect(303, target);
	}
};
