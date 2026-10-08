<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import SetupNotice from '#lib/components/SetupNotice.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const path = $derived(page.url.pathname);
	const studyActive = $derived(path === '/' || path.startsWith('/study'));
	const readActive = $derived(path.startsWith('/read'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !data.configured || data.dbError}
	<main class="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-16">
		<SetupNotice configured={data.configured} dbError={data.dbError} />
	</main>
{:else}
	<div class="min-h-screen">
		{#if data.user}
			<header
				class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6"
			>
				<a href="/" class="font-serif text-2xl tracking-tight">Quick French</a>
				<nav class="flex items-center gap-1 text-sm">
					<a
						href="/"
						class={['rounded-full px-3 py-2', studyActive ? 'bg-navy text-cream' : 'text-ink']}
						aria-current={studyActive ? 'page' : undefined}
					>
						Study
					</a>
					<a
						href="/read"
						class={['rounded-full px-3 py-2', readActive ? 'bg-navy text-cream' : 'text-ink']}
						aria-current={readActive ? 'page' : undefined}
					>
						Reader
					</a>
					<span class="hidden px-2 text-muted sm:inline">{data.user.username}</span>
					<form method="POST" action="/logout">
						<button type="submit" class="rounded-full px-3 py-2 text-muted">Log out</button>
					</form>
				</nav>
			</header>
		{/if}
		<main class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			{@render children()}
		</main>
		{#if data.user}
			<footer class="mx-auto w-full max-w-5xl px-4 pb-10 text-sm text-muted sm:px-6">
				Words from FLELex (UCLouvain). Reviews use FSRS with a 90% recall target.
			</footer>
		{/if}
	</div>
{/if}
