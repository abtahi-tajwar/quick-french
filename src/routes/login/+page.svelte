<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in · Quick French</title>
</svelte:head>

<section class="mx-auto mt-10 max-w-md rounded-3xl bg-cream p-8 ring-1 ring-line">
	<p class="font-serif text-3xl">Quick French</p>
	<h1 class="mt-2 text-sm text-muted">Sign in to study and read.</h1>
	<form method="POST" class="mt-6 space-y-4">
		<label class="block text-sm">
			Username
			<input
				class="mt-1 w-full rounded-xl border-line bg-paper"
				name="username"
				autocomplete="username"
				value={form?.username ?? ''}
				required
			/>
		</label>
		<label class="block text-sm">
			Password
			<input
				class="mt-1 w-full rounded-xl border-line bg-paper"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</label>
		{#if form?.message}
			<p class="rounded-xl bg-blush px-3 py-2 text-sm">{form.message}</p>
		{/if}
		<button type="submit" class="w-full rounded-full bg-navy px-4 py-2.5 text-sm text-cream">
			Sign in
		</button>
	</form>
	<details class="mt-6 text-sm text-muted">
		<summary class="cursor-pointer">First time here?</summary>
		<p class="mt-2 leading-6">
			Run supabase/schema.sql, fill in .env, then npm run seed. The username and password are
			SEED_USERNAME and SEED_PASSWORD.
		</p>
	</details>
</section>
