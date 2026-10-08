<script lang="ts">
	import { browser } from '$app/env';
	import { onDestroy } from 'svelte';
	import type { StudyPayload } from '#lib/cards';
	import { formatWhen } from '#lib/dates';
	import type { Deck } from '#lib/levels';
	import { DAILY_NEW_LIMIT, SHORT_TERM_MS } from '#lib/study-config';

	let { deck, initial }: { deck: Deck; initial: StudyPayload } = $props();

	function startingPayload() {
		return initial;
	}

	let payload = $state.raw(startingPayload());
	let revealed = $state(false);
	let busy = $state(false);
	let errorMessage = $state('');
	let session = $state({ again: 0, hard: 0, good: 0, easy: 0 });
	let timer: ReturnType<typeof setTimeout> | undefined;

	const emptyCopy: Record<NonNullable<StudyPayload['emptyReason']>, string> = {
		quota: `You've met today's ${DAILY_NEW_LIMIT} new words. Reviews show up here when they're due.`,
		caught_up: 'Nothing is due in this deck.',
		clear: 'Nothing here needs extra work right now.',
		no_words: 'This level has no words yet. Run npm run seed after the database is ready.'
	};

	function clearTimer() {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function arm(nextDue: string | null) {
		clearTimer();
		if (!nextDue) return;
		const wait = new Date(nextDue).getTime() - Date.now();
		if (wait <= 0 || wait > SHORT_TERM_MS) return;
		timer = setTimeout(() => {
			void loadDeck();
		}, wait + 400);
	}

	function apply(next: StudyPayload) {
		payload = next;
		revealed = false;
		if (next.card) clearTimer();
		else if (browser) arm(next.nextDue);
	}

	async function loadDeck() {
		const response = await fetch(`/api/study?deck=${deck}`);
		const body = (await response.json()) as StudyPayload & { message?: string };
		if (!response.ok) {
			errorMessage = body.message ?? 'Could not load the next card.';
			return;
		}
		apply(body);
	}

	async function rate(rating: 1 | 2 | 3 | 4) {
		if (!payload.card || busy) return;
		busy = true;
		errorMessage = '';
		const wordId = payload.card.wordId;
		try {
			const response = await fetch('/api/study', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deck, wordId, rating })
			});
			const body = (await response.json()) as StudyPayload & { message?: string };
			if (!response.ok) {
				errorMessage = body.message ?? 'Could not save that review.';
				return;
			}
			if (rating === 1) session.again += 1;
			if (rating === 2) session.hard += 1;
			if (rating === 3) session.good += 1;
			if (rating === 4) session.easy += 1;
			apply(body);
		} catch {
			errorMessage = 'Could not reach the server.';
		} finally {
			busy = false;
		}
	}

	function speak() {
		if (!payload.card || typeof speechSynthesis === 'undefined') return;
		const utterance = new SpeechSynthesisUtterance(payload.card.lemma);
		utterance.lang = 'fr-FR';
		utterance.rate = 0.92;
		speechSynthesis.cancel();
		speechSynthesis.speak(utterance);
	}

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
		if ((event.key === ' ' || event.key === 'Enter') && payload.card && !revealed) {
			event.preventDefault();
			revealed = true;
			return;
		}
		if (!revealed || busy || !payload.card) return;
		const ratings = { '1': 1, '2': 2, '3': 3, '4': 4 } as const;
		const rating = ratings[event.key as keyof typeof ratings];
		if (!rating) return;
		event.preventDefault();
		void rate(rating);
	}

	const reviewed = $derived(session.again + session.hard + session.good + session.easy);
	const when = $derived(payload.nextDue ? formatWhen(payload.nextDue) : '');

	function resumeShortReviews() {
		if (browser && !initial.card) arm(initial.nextDue);
	}

	resumeShortReviews();
	onDestroy(clearTimer);
</script>

<svelte:window onkeydown={onKey} />

{#if payload.card}
	{@const card = payload.card}
	<div class="mx-auto max-w-2xl">
		<p class="text-sm text-muted">
			{card.posLabel} · {card.level}
			{#if reviewed > 0}
				· {reviewed} this sitting
			{/if}
		</p>
		<div class="mt-4 rounded-[2rem] bg-cream px-6 py-10 text-center ring-1 ring-line sm:px-10">
			<button
				type="button"
				class="font-serif text-5xl leading-tight text-ink sm:text-6xl"
				onclick={() => (revealed = true)}
			>
				<span lang="fr">{card.lemma}</span>
			</button>
			<div class="mt-6 flex justify-center">
				<button
					type="button"
					class="rounded-full px-4 py-2 text-sm text-navy ring-1 ring-line"
					onclick={speak}
				>
					Listen
				</button>
			</div>
			{#if revealed}
				<p class="mt-8 font-serif text-3xl text-navy">{card.translation}</p>
				<div class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted">
					{#if card.retrievability !== null}
						<p>Recall chance before this review: {Math.round(card.retrievability * 100)}%</p>
					{/if}
					{#if card.lapses > 0}
						<p>{card.lapses === 1 ? 'Missed once' : `Missed ${card.lapses} times`}</p>
					{/if}
				</div>
			{:else}
				<p class="mt-8 text-sm text-muted">Tap the word, or press space.</p>
			{/if}
		</div>

		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each payload.grades as grade (grade.rating)}
				<button
					type="button"
					class={[
						'rounded-2xl px-3 py-3 text-sm font-medium disabled:opacity-40',
						grade.rating === 1 && 'bg-blush text-coral',
						grade.rating === 2 && 'bg-cream text-ink ring-1 ring-line',
						grade.rating === 3 && 'bg-navy text-cream',
						grade.rating === 4 && 'bg-moss text-cream'
					]}
					disabled={!revealed || busy}
					onclick={() => rate(grade.rating)}
				>
					{grade.label}
					<span class="mt-1 block text-xs opacity-80">{grade.interval}</span>
				</button>
			{/each}
		</div>
		<p class="mt-3 text-center text-xs text-muted">Keys 1 to 4 after you reveal the answer.</p>
	</div>
{:else}
	<div class="mx-auto max-w-xl rounded-[2rem] bg-cream px-8 py-12 text-center ring-1 ring-line">
		<h2 class="font-serif text-4xl">
			{payload.emptyReason === 'quota'
				? "That's today's set"
				: payload.emptyReason === 'no_words'
					? 'No words yet'
					: "You're clear"}
		</h2>
		{#if payload.emptyReason}
			<p class="mt-4 text-muted">{emptyCopy[payload.emptyReason]}</p>
		{/if}
		{#if when}
			<p class="mt-3 text-sm text-ink">Next review {when}.</p>
		{/if}
		{#if reviewed > 0}
			<p class="mt-6 text-sm text-muted">
				This sitting: {session.again} again · {session.hard} hard · {session.good} good · {session.easy}
				easy
			</p>
		{/if}
		<a href="/" class="mt-8 inline-block rounded-full bg-navy px-5 py-2 text-sm text-cream">
			Back to levels
		</a>
	</div>
{/if}

{#if errorMessage}
	<p class="mx-auto mt-4 max-w-xl rounded-2xl bg-blush px-4 py-3 text-center text-sm">
		{errorMessage}
	</p>
{/if}
