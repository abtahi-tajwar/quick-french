import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() ?? '';

export const variables = defineEnvVars({
	SUPABASE_URL: { schema: optional },
	SUPABASE_SERVICE_ROLE_KEY: { schema: optional },
	OPENAI_API_KEY: { schema: optional },
	OPENAI_MODEL: {
		schema: (value: string | undefined) => value?.trim() || 'gpt-4.1-mini'
	}
});
