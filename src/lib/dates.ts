import { STUDY_TIMEZONE } from '#lib/study-config';

export function studyDay(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: STUDY_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

export function shiftDay(iso: string, delta: number) {
	const [year, month, day] = iso.split('-').map(Number);
	return studyDay(new Date(Date.UTC(year, month - 1, day + delta, 16)));
}

export function streakFrom(timestamps: string[]) {
	const days = new Set(timestamps.map((value) => studyDay(new Date(value))));
	let cursor = studyDay();
	if (!days.has(cursor)) cursor = shiftDay(cursor, -1);
	let count = 0;
	while (days.has(cursor)) {
		count += 1;
		cursor = shiftDay(cursor, -1);
	}
	return count;
}

export function formatWhen(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat('en-US', {
		timeZone: STUDY_TIMEZONE,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}
