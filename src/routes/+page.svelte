<script lang="ts">
	import { LEVELS, LEVEL_META } from '#lib/levels';
	import { DAILY_NEW_LIMIT, REQUEST_RETENTION } from '#lib/study-config';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dashboard = $derived(data.dashboard);
	const levels = $derived(
		LEVELS.map((level) => {
			const stat = dashboard?.stats[level];
			const total = stat?.total ?? 0;
			const mastered = stat?.mastered ?? 0;
			return {
				level,
				...LEVEL_META[level],
				stat,
				pct: total === 0 ? 0 : Math.round((mastered / total) * 100)
			};
		})
	);
</script>

<svelte:head>
	<title>Study · Quick French</title>
</svelte:head>

{#if data.dashboardError}
	<p class="rounded-2xl bg-blush px-4 py-3 text-sm">{data.dashboardError}</p>
{:else if dashboard}
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm text-muted">Bonjour</p>
			<h1 class="font-serif text-5xl tracking-tight">Your French</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if dashboard.totals.due > 0}
				<a href="/study/due" class="rounded-full bg-navy px-4 py-2 text-sm text-cream">
					Review {dashboard.totals.due} due
				</a>
			{/if}
			{#if dashboard.totals.needsWork > 0}
				<a href="/study/practice" class="rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-line">
					Practice {dashboard.totals.needsWork} shaky
				</a>
			{/if}
		</div>
	</div>

	<section class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<article class="rounded-2xl bg-cream px-4 py-4 ring-1 ring-line">
			<p class="text-sm text-muted">Due</p>
			<p class="font-serif text-4xl">{dashboard.totals.due}</p>
		</article>
		<article class="rounded-2xl bg-cream px-4 py-4 ring-1 ring-line">
			<p class="text-sm text-muted">Practiced</p>
			<p class="font-serif text-4xl">{dashboard.totals.practiced}</p>
		</article>
		<article class="rounded-2xl bg-cream px-4 py-4 ring-1 ring-line">
			<p class="text-sm text-muted">Mastered</p>
			<p class="font-serif text-4xl">{dashboard.totals.mastered}</p>
		</article>
		<article class="rounded-2xl bg-cream px-4 py-4 ring-1 ring-line">
			<p class="text-sm text-muted">Day streak</p>
			<p class="font-serif text-4xl">{dashboard.streak}</p>
		</article>
	</section>

	<section class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each levels as level (level.level)}
			<a
				href="/study/{level.level}"
				class="rounded-3xl bg-cream p-5 ring-1 ring-line transition hover:-translate-y-0.5"
			>
				<div class="flex items-baseline justify-between gap-3">
					<h2 class="font-serif text-4xl">{level.level}</h2>
					<p class="text-sm text-muted">{level.blurb}</p>
				</div>
				<p class="mt-4 text-sm text-muted">{level.stat?.total ?? 0} words</p>
				<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
					<div class={['h-full', level.accent]} style:width="{level.pct}%"></div>
				</div>
				<p class="mt-3 text-sm">
					{level.stat?.due ?? 0} due · {level.stat?.needsWork ?? 0} shaky · {level.stat?.mastered ??
						0}
					mastered
				</p>
			</a>
		{/each}
	</section>

	<section class="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
		<details class="rounded-3xl bg-cream p-5 ring-1 ring-line">
			<summary class="cursor-pointer font-medium">How cards are chosen</summary>
			<div class="mt-3 space-y-2 text-sm leading-6 text-muted">
				<p>
					Reviews use FSRS, the scheduler Anki uses, aimed at a {Math.round(
						REQUEST_RETENTION * 100
					)}% chance you still remember a word when it returns.
				</p>
				<p>
					Again comes back in about a minute. Hard and Good stay in short learning steps, then the
					gap grows in days. Easy can leave the learning steps immediately.
				</p>
				<p>
					Due learning cards come first, then reviews, then up to {DAILY_NEW_LIMIT} new words. New words
					are the most frequent ones you have not studied in that level.
				</p>
				<p>
					Shaky words are still in learning, have been missed more than once, or are young cards you
					missed. Mastered means a review card with at least 21 days of memory stability.
				</p>
			</div>
		</details>
		<section class="rounded-3xl bg-cream p-5 ring-1 ring-line">
			<div class="flex items-baseline justify-between">
				<h2 class="font-serif text-2xl">Reader</h2>
				<a href="/read" class="text-sm text-navy">Open</a>
			</div>
			{#if dashboard.readings.length === 0}
				<p class="mt-3 text-sm text-muted">
					Upload a PDF and the first page is split into phrases.
				</p>
			{:else}
				<ul class="mt-3 space-y-2 text-sm">
					{#each dashboard.readings as reading (reading.id)}
						<li>
							<a href="/read/{reading.id}" class="text-navy">{reading.filename}</a>
							<span class="text-muted"> · {reading.page_count} pages</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</section>
{/if}
