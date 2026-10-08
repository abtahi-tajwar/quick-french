import { loadDashboard } from '#lib/server/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { dashboard: null, dashboardError: null };
	try {
		return { dashboard: await loadDashboard(locals.user.id), dashboardError: null };
	} catch (error) {
		console.error(error);
		return {
			dashboard: null,
			dashboardError:
				'Could not load your study stats. If this is a new project, run supabase/schema.sql and npm run seed.'
		};
	}
};
