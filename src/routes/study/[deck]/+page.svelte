<script lang="ts">
	import Flashcard from '#lib/components/Flashcard.svelte';
	import { deckBlurb, deckTitle } from '#lib/levels';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{deckTitle(data.deck)} · Quick French</title>
</svelte:head>

<div class="mb-6">
	<a href="/" class="text-sm text-muted">All levels</a>
	<h1 class="mt-1 font-serif text-4xl">{deckTitle(data.deck)}</h1>
	<p class="mt-1 text-sm text-muted">{deckBlurb(data.deck)}</p>
</div>

{#key data.deck}
	<Flashcard deck={data.deck} initial={data.study} />
{/key}
