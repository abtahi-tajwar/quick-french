import { getDocumentProxy } from 'unpdf';

export function cleanPageText(text: string) {
	return text
		.replaceAll('\u0000', '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

async function closePdf(pdf: object) {
	const closable = pdf as { cleanup?: () => unknown };
	if (typeof closable.cleanup === 'function') await closable.cleanup();
}

export async function countPages(bytes: Uint8Array) {
	const pdf = await getDocumentProxy(bytes.slice());
	try {
		return pdf.numPages;
	} finally {
		await closePdf(pdf);
	}
}

export async function extractPageText(bytes: Uint8Array, pageNumber: number) {
	const pdf = await getDocumentProxy(bytes.slice());
	try {
		const totalPages = pdf.numPages;
		if (pageNumber < 1 || pageNumber > totalPages) {
			return { totalPages, text: '' };
		}
		const page = await pdf.getPage(pageNumber);
		const content = await page.getTextContent();
		let text = '';
		for (const item of content.items) {
			if (!item || typeof item !== 'object' || !('str' in item)) continue;
			const piece = item as { str?: string; hasEOL?: boolean };
			text += piece.str ?? '';
			if (piece.hasEOL) text += '\n';
		}
		return { totalPages, text: cleanPageText(text) };
	} finally {
		await closePdf(pdf);
	}
}
