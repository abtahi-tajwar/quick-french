<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let filename = $state('');
	let uploading = $state(false);

	function onChoose(event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		filename = input.files?.[0]?.name ?? '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		const input = event.currentTarget;
		if (!(input instanceof HTMLElement) || !file) return;
		const field = input.querySelector('input');
		if (!(field instanceof HTMLInputElement)) return;
		const transfer = new DataTransfer();
		transfer.items.add(file);
		field.files = transfer.files;
		filename = file.name;
	}
</script>

<svelte:head>
	<title>Reader · Quick French</title>
</svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="font-serif text-5xl">Reader</h1>
		<p class="mt-2 max-w-xl text-sm text-muted">
			Upload a PDF. The first page is copied and sent to OpenAI, which splits the French into
			phrases. Other pages stay put until you ask for them.
		</p>
	</div>
</div>

<form
	method="POST"
	enctype="multipart/form-data"
	class="mt-8"
	use:enhance={() => {
		uploading = true;
		return async ({ update }) => {
			await update();
			uploading = false;
		};
	}}
>
	<label
		class="block cursor-pointer rounded-3xl border border-dashed border-line bg-cream px-6 py-10 text-center"
		ondragover={(event) => event.preventDefault()}
		ondrop={onDrop}
	>
		<input
			class="sr-only"
			type="file"
			name="pdf"
			accept="application/pdf,.pdf"
			required
			onchange={onChoose}
		/>
		<span class="font-serif text-2xl">{filename || 'Drop a PDF, or choose one'}</span>
		<span class="mt-2 block text-sm text-muted"
			>12 MB maximum. One page is segmented at a time.</span
		>
	</label>
	{#if form?.message}
		<p class="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm">{form.message}</p>
	{/if}
	{#if data.listError}
		<p class="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm">{data.listError}</p>
	{/if}
	<button
		type="submit"
		class="mt-4 rounded-full bg-navy px-5 py-2.5 text-sm text-cream disabled:opacity-50"
		disabled={uploading}
	>
		{uploading ? 'Reading the first page…' : 'Open this PDF'}
	</button>
</form>

{#if data.documents.length > 0}
	<ul class="mt-10 divide-y divide-line rounded-3xl bg-cream ring-1 ring-line">
		{#each data.documents as document (document.id)}
			<li class="flex items-center justify-between gap-4 px-5 py-4">
				<a href="/read/{document.id}" class="min-w-0">
					<span class="block truncate font-medium">{document.filename}</span>
					<span class="text-sm text-muted">{document.page_count} pages</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
