-- Quick French
-- Run this once in the Supabase SQL editor.
-- The app uses the service role key on the server. Row level security stays
-- on, with no policies, so the anon key cannot read or write these tables.

create extension if not exists pgcrypto;

create table public.users (
	id uuid primary key default gen_random_uuid(),
	username text not null unique,
	password_hash text not null,
	created_at timestamptz not null default now()
);

create table public.sessions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	token_hash text not null unique,
	expires_at timestamptz not null,
	created_at timestamptz not null default now()
);

create table public.words (
	id uuid primary key default gen_random_uuid(),
	lemma text not null,
	pos text not null,
	level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	translation text not null,
	frequency_rank integer not null,
	unique (lemma, pos)
);

create index words_level_rank_idx on public.words (level, frequency_rank);

-- FSRS card state. state: 0 new, 1 learning, 2 review, 3 relearning.
create table public.card_states (
	user_id uuid not null references public.users (id) on delete cascade,
	word_id uuid not null references public.words (id) on delete cascade,
	due timestamptz not null,
	stability double precision not null,
	difficulty double precision not null,
	elapsed_days integer not null default 0,
	scheduled_days integer not null default 0,
	learning_steps integer not null default 0,
	reps integer not null default 0,
	lapses integer not null default 0,
	state smallint not null default 0,
	last_review timestamptz,
	introduced_on date not null,
	primary key (user_id, word_id)
);

create index card_states_due_idx on public.card_states (user_id, due);

create table public.review_logs (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	word_id uuid not null references public.words (id) on delete cascade,
	rating smallint not null check (rating between 1 and 4),
	state_before smallint not null,
	reviewed_at timestamptz not null default now()
);

create index review_logs_user_time_idx on public.review_logs (user_id, reviewed_at desc);

create table public.documents (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	filename text not null,
	page_count integer not null check (page_count > 0),
	created_at timestamptz not null default now()
);

create index documents_user_idx on public.documents (user_id, created_at desc);

create table public.page_segments (
	document_id uuid not null references public.documents (id) on delete cascade,
	page_number integer not null check (page_number > 0),
	source_text text not null,
	phrases jsonb not null,
	created_at timestamptz not null default now(),
	primary key (document_id, page_number)
);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.words enable row level security;
alter table public.card_states enable row level security;
alter table public.review_logs enable row level security;
alter table public.documents enable row level security;
alter table public.page_segments enable row level security;
