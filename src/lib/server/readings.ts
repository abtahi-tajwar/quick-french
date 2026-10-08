import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asPhrases, type Phrase } from '#lib/phrases';
import { countPages, extractPageText } from '#lib/server/pdf';
import { SegmentError, segmentFrench } from '#lib/server/openai';
import { db } from '#lib/server/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 12 * 1024 * 1024;

export function cleanFilename(name: string) {
	const base = name.split(/[/\\]/).pop() ?? 'document.pdf';
	const cleaned = base
		.replace(/[^\p{L}\p{N}._ ()'-]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return (cleaned || 'document.pdf').slice(0, 180);
}

export function readingPath(id: string) {
	if (!UUID.test(id)) throw new SegmentError('Unknown document.', 'pdf');
	return join(process.cwd(), 'data', 'readings', `${id}.pdf`);
}

function database() {
	const client = db();
	if (!client) throw new SegmentError('Supabase is not configured.', 'pdf');
	return client;
}

export async function getDocument(userId: string, id: string) {
	if (!UUID.test(id)) return null;
	const { data, error } = await database()
		.from('documents')
		.select('id, filename, page_count, created_at')
		.eq('id', id)
		.eq('user_id', userId)
		.maybeSingle();
	if (error) {
		console.error(error.message);
		throw new SegmentError('Could not open that PDF.', 'pdf');
	}
	return data;
}

export async function listDocuments(userId: string) {
	const { data, error } = await database()
		.from('documents')
		.select('id, filename, page_count, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (error) {
		console.error(error.message);
		throw new SegmentError('Could not list your PDFs.', 'pdf');
	}
	return data ?? [];
}

export async function savePdf(userId: string, file: File) {
	if (!file || file.size === 0) throw new SegmentError('Choose a PDF first.', 'pdf');
	if (file.size > MAX_BYTES) throw new SegmentError('PDFs need to be 12 MB or smaller.', 'pdf');

	const bytes = new Uint8Array(await file.arrayBuffer());
	if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
		throw new SegmentError('That file is not a PDF.', 'pdf');
	}

	let pageCount: number;
	try {
		pageCount = await countPages(bytes);
	} catch (error) {
		console.error(error);
		throw new SegmentError('That PDF could not be opened.', 'pdf');
	}
	if (pageCount < 1) throw new SegmentError('That PDF has no pages.', 'pdf');

	const id = crypto.randomUUID();
	const directory = join(process.cwd(), 'data', 'readings');
	await mkdir(directory, { recursive: true });
	await writeFile(readingPath(id), bytes);

	const inserted = await database()
		.from('documents')
		.insert({
			id,
			user_id: userId,
			filename: cleanFilename(file.name),
			page_count: pageCount
		});
	if (inserted.error) {
		await rm(readingPath(id), { force: true });
		console.error(inserted.error.message);
		throw new SegmentError('Could not save that PDF.', 'pdf');
	}

	return { id, pageCount };
}

export async function readStoredPdf(id: string) {
	return readFile(readingPath(id));
}

export async function segmentDocumentPage(userId: string, id: string, pageNumber: number) {
	const document = await getDocument(userId, id);
	if (!document) throw new SegmentError('Unknown document.', 'pdf');
	if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.page_count) {
		throw new SegmentError('That page is outside this PDF.', 'pdf');
	}

	const bytes = new Uint8Array(await readStoredPdf(id));
	let text: string;
	try {
		text = (await extractPageText(bytes, pageNumber)).text;
	} catch (error) {
		if (error instanceof SegmentError) throw error;
		console.error(error);
		throw new SegmentError('That page could not be read.', 'pdf');
	}

	const phrases = await segmentFrench(text);
	const saved = await database()
		.from('page_segments')
		.upsert(
			{
				document_id: id,
				page_number: pageNumber,
				source_text: text.slice(0, 20000),
				phrases
			},
			{ onConflict: 'document_id,page_number' }
		);
	if (saved.error) {
		console.error(saved.error.message);
		throw new SegmentError('The phrases were read, but they could not be saved.', 'pdf');
	}
	return phrases;
}

export async function loadSegment(
	id: string,
	pageNumber: number
): Promise<{
	sourceText: string;
	phrases: Phrase[];
} | null> {
	const { data, error } = await database()
		.from('page_segments')
		.select('source_text, phrases')
		.eq('document_id', id)
		.eq('page_number', pageNumber)
		.maybeSingle();
	if (error) {
		console.error(error.message);
		throw new SegmentError('Could not load the saved phrases.', 'pdf');
	}
	if (!data) return null;
	return { sourceText: data.source_text as string, phrases: asPhrases(data.phrases) };
}

export async function removeDocument(userId: string, id: string) {
	const document = await getDocument(userId, id);
	if (!document) return false;
	const { error } = await database().from('documents').delete().eq('id', id).eq('user_id', userId);
	if (error) {
		console.error(error.message);
		throw new SegmentError('Could not delete that PDF.', 'pdf');
	}
	await rm(readingPath(id), { force: true });
	return true;
}
