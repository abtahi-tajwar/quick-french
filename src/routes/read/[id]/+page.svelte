<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import PhraseReader from '#lib/components/PhraseReader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let segmenting = $state(false);

	const previous = $derived(Math.max(1, data.page - 1));
	const next = $derived(Math.min(data.document.page_count, data.page + 1));

	function goToPage(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;
		const requested = Number(new FormData(form).get('page'));
		const page = Number.isFinite(requested)
			? Math.min(Math.max(Math.trunc(requested), 1), data.document.page_count)
			: data.page;
		const input = form.elements.namedItem('page');
		if (input instanceof HTMLInputElement) input.value = String(page);
		if (page !== data.page) goto(`?page=${page}`);
	}
</script>

<svelte:head>
	<title>{data.document.filename} · Quick French</title>
</svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div class="min-w-0">
		<a href="/read" class="text-sm text-muted">All PDFs</a>
		<h1 class="mt-1 truncate font-serif text-4xl">{data.document.filename}</h1>
	</div>
	<form method="POST" action="?/remove">
		<button type="submit" class="text-sm text-muted">Delete</button>
	</form>
</div>

<div class="mt-6 flex flex-wrap items-center gap-3">
	<a
		class={[
			'rounded-full px-3 py-2 text-sm ring-1 ring-line',
			data.page === 1 && 'pointer-events-none opacity-40'
		]}
		href="?page={previous}"
	>
		Previous
	</a>
	{#key data.page}
		<form class="flex items-center gap-2 text-sm" onsubmit={goToPage} novalidate>
			<label>
				Page
				<input
					class="ml-1 w-16 rounded-lg border-line bg-paper px-2 py-1 text-center"
					name="page"
					type="number"
					inputmode="numeric"
					min="1"
					max={data.document.page_count}
					value={data.page}
					aria-label="Page number"
					required
				/>
			</label>
			<span>of {data.document.page_count}</span>
		</form>
	{/key}
	<a
		class={[
			'rounded-full px-3 py-2 text-sm ring-1 ring-line',
			data.page === data.document.page_count && 'pointer-events-none opacity-40'
		]}
		href="?page={next}"
	>
		Next
	</a>
	<form
		method="POST"
		action="?/segment&page={data.page}"
		use:enhance={() => {
			segmenting = true;
			return async ({ update }) => {
				await update({ navigate: false });
				segmenting = false;
			};
		}}
	>
		<input type="hidden" name="page" value={data.page} />
		<button
			type="submit"
			class="rounded-full bg-navy px-4 py-2 text-sm text-cream disabled:opacity-50"
			disabled={segmenting}
		>
			{segmenting ? 'Reading this page…' : data.phrases.length ? 'Segment again' : 'Read this page'}
		</button>
	</form>
</div>

{#if data.notice}
	<p class="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm">{data.notice}</p>
{/if}
{#if form?.message}
	<p class="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm">{form.message}</p>
{/if}

<section class="mt-8 rounded-3xl bg-cream p-6 ring-1 ring-line sm:p-8">
	{#if data.phrases.length}
		<p class="mb-5 text-sm text-muted">Click a phrase to see the English.</p>
		{#key data.page}
			<PhraseReader phrases={data.phrases} />
		{/key}
		{#if data.sourceText}
			<details class="mt-8 text-sm text-muted">
				<summary class="cursor-pointer">Text sent to the model</summary>
				<p class="mt-3 whitespace-pre-wrap">{data.sourceText}</p>
			</details>
		{/if}
	{:else}
		<p class="text-muted">
			This page is loaded. Segment it when you want the French phrases. Only this page is sent.
		</p>
	{/if}
</section>

<details class="mt-4 rounded-3xl bg-cream ring-1 ring-line">
	<summary class="cursor-pointer px-6 py-4 text-sm">Original page</summary>
	<iframe
		class="h-[75vh] w-full border-t border-line bg-white"
		title="Page {data.page} of {data.document.filename}"
		src="/read/{data.document.id}/file#page={data.page}"
	></iframe>
</details>
