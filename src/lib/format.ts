export function formatInterval(from: Date, due: Date) {
	const minutes = Math.round((due.getTime() - from.getTime()) / 60000);
	if (minutes < 1) return '<1m';
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.round((due.getTime() - from.getTime()) / 86400000);
	if (days < 30) return `${days}d`;
	if (days < 365) return `${Math.max(1, Math.round(days / 30))}mo`;
	return `${(days / 365).toFixed(1)}y`;
}
