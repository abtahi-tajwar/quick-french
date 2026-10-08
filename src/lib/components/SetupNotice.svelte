<script lang="ts">
	let { configured, dbError }: { configured: boolean; dbError: string | null } = $props();
</script>

<section class="w-full rounded-3xl bg-cream p-8 ring-1 ring-line">
	<p class="text-sm tracking-wide text-muted uppercase">Quick French</p>
	<h1 class="mt-2 font-serif text-4xl">Connect the database</h1>
	{#if dbError}
		<p class="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm text-ink">{dbError}</p>
	{:else if !configured}
		<p class="mt-4 text-muted">
			The app stores words, reviews, and phrase segments in Supabase. Add the project URL and
			service role key, then seed the deck.
		</p>
	{/if}
	<ol class="mt-6 space-y-3 text-sm leading-6">
		<li>Create a Supabase project and open the SQL editor.</li>
		<li>Run <span class="font-medium">supabase/schema.sql</span>.</li>
		<li>
			Copy <span class="font-medium">.env.example</span> to
			<span class="font-medium">.env</span> and fill in
			<span class="font-medium">SUPABASE_URL</span>,
			<span class="font-medium">SUPABASE_SERVICE_ROLE_KEY</span>, and
			<span class="font-medium">OPENAI_API_KEY</span>.
		</li>
		<li>
			Run <span class="font-medium">npm run seed</span>. That creates the single account from
			<span class="font-medium">SEED_USERNAME</span> and
			<span class="font-medium">SEED_PASSWORD</span>.
		</li>
		<li>Restart <span class="font-medium">npm run dev</span> and sign in.</li>
	</ol>
</section>
