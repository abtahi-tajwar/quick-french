import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() ?? '';

export const variables = defineEnvVars({
	SUPABASE_URL: { static: false, schema: optional },
	SUPABASE_SERVICE_ROLE_KEY: { static: false, schema: optional },
	OPENAI_API_KEY: { static: false, schema: optional },
	OPENAI_MODEL: {
		static: false,
		schema: (value: string | undefined) => value?.trim() || 'gpt-4.1-mini'
	}
});
