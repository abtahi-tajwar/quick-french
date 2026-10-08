<script lang="ts">
	import type { Phrase } from '#lib/phrases';

	let { phrases }: { phrases: Phrase[] } = $props();

	let active = $state<Phrase | null>(null);
	let pop = $state({ top: 0, left: 0 });

	const blocks = $derived.by(() => {
		const groups: { key: string; heading: boolean; phrases: Phrase[] }[] = [];
		for (const phrase of phrases) {
			const last = groups.at(-1);
			if (phrase.heading) {
				if (last?.heading) last.phrases.push(phrase);
				else groups.push({ key: phrase.id, heading: true, phrases: [phrase] });
				continue;
			}
			const words =
				last && !last.heading
					? last.phrases.reduce((count, item) => count + item.french.trim().split(/\s+/).length, 0)
					: 0;
			const sentenceDone =
				!!last && !last.heading && /[.!?…]["»)]*$/.test(last.phrases.at(-1)?.french.trim() ?? '');
			if (last && !last.heading && !(sentenceDone && words >= 22)) {
				last.phrases.push(phrase);
			} else {
				groups.push({ key: phrase.id, heading: false, phrases: [phrase] });
			}
		}
		return groups;
	});

	function choose(phrase: Phrase, event: MouseEvent | KeyboardEvent) {
		const button = event.currentTarget;
		if (!(button instanceof HTMLElement)) return;
		if (active?.id === phrase.id) {
			active = null;
			return;
		}
		const rect = button.getBoundingClientRect();
		const width = 288;
		let left = rect.left;
		if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
		left = Math.max(12, left);
		let top = rect.bottom + 8;
		if (top + 150 > window.innerHeight - 12) top = Math.max(12, rect.top - 158);
		pop = { top, left };
		active = phrase;
	}

	function onPointerDown(event: PointerEvent) {
		if (!active) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('[data-popover]') || target.closest('[data-phrase]')) return;
		active = null;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') active = null;
	}
</script>

<svelte:window onkeydown={onKey} onpointerdown={onPointerDown} />

<div class="reading">
	{#each blocks as block (block.key)}
		{#if block.heading}
			<h2 class="heading">
				{#each block.phrases as phrase (phrase.id)}
					<span
						class="phrase"
						role="button"
						tabindex="0"
						data-phrase
						aria-expanded={active?.id === phrase.id}
						onclick={(event) => choose(phrase, event)}
						onkeydown={(event) => {
							if (event.key !== 'Enter' && event.key !== ' ') return;
							event.preventDefault();
							choose(phrase, event);
						}}
					>
						{phrase.french.replace(/\s+/g, ' ') + ' '}
					</span>
				{/each}
			</h2>
		{:else}
			<p class="paragraph" lang="fr">
				{#each block.phrases as phrase (phrase.id)}
					<span
						class="phrase"
						role="button"
						tabindex="0"
						data-phrase
						aria-expanded={active?.id === phrase.id}
						onclick={(event) => choose(phrase, event)}
						onkeydown={(event) => {
							if (event.key !== 'Enter' && event.key !== ' ') return;
							event.preventDefault();
							choose(phrase, event);
						}}
					>
						{phrase.french.replace(/\s+/g, ' ') + ' '}
					</span>
				{/each}
			</p>
		{/if}
	{/each}
</div>

{#if active}
	<div
		class="fixed z-30 w-72 rounded-2xl bg-cream p-4 shadow-[0_18px_50px_-24px_rgba(28,25,22,0.45)] ring-1 ring-line"
		style:top="{pop.top}px"
		style:left="{pop.left}px"
		role="dialog"
		aria-label="Phrase meaning"
		data-popover
	>
		<p class="text-xs tracking-wide text-muted uppercase">English</p>
		<p class="mt-1 text-base leading-snug">{active.english}</p>
		<p class="mt-3 text-sm text-muted" lang="fr">{active.french}</p>
		<button type="button" class="mt-3 text-sm text-navy" onclick={() => (active = null)}>
			Close
		</button>
	</div>
{/if}

<style>
	.reading {
		color: var(--color-ink);
		font-family: var(--font-sans);
		font-size: 1.0625rem;
		font-weight: 400;
		line-height: 1.65;
		text-align: justify;
	}

	.paragraph {
		margin: 0 0 1rem;
		text-align: justify;
		text-align-last: left;
		hyphens: auto;
	}

	.paragraph:last-child {
		margin-bottom: 0;
	}

	.heading {
		margin: 1.4rem 0 0;
		font-family: var(--font-serif);
		font-size: 1.35rem;
		font-weight: 560;
		line-height: 1.35;
		text-align: left;
	}

	.heading:first-child {
		margin-top: 0;
	}

	.phrase {
		display: inline;
		width: auto;
		margin: 0;
		padding: 0 0.08em;
		border: 0;
		border-radius: 0.2rem;
		appearance: none;
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: inherit;
		text-align: inherit;
		cursor: pointer;
	}

	.phrase:hover,
	.phrase[aria-expanded='true'] {
		background: var(--color-blush);
	}
</style>
