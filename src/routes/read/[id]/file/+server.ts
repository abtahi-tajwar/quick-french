import { error } from '@sveltejs/kit';
import { getDocument, readStoredPdf } from '#lib/server/readings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in first.');
	const document = await getDocument(locals.user.id, params.id);
	if (!document) error(404, 'Unknown document');

	let bytes: Buffer;
	try {
		bytes = await readStoredPdf(params.id);
	} catch {
		error(404, 'The PDF file is missing on this machine.');
	}

	const filename = document.filename.replace(/["\r\n]/g, '');
	const body = new Uint8Array(bytes.byteLength);
	body.set(bytes);
	return new Response(body, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${filename}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
