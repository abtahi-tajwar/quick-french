# Quick French

Flashcards for French levels A1–C2, and a PDF reader that segments one page at a time into clickable phrases.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env`.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.
4. Run `npm run seed`.
5. Run `npm run dev` and sign in with `SEED_USERNAME` and `SEED_PASSWORD`.

The seed account is the only account. There is no signup screen.

Use the service role key. It stays on the server. Row level security is enabled with no public policies, so the anon key cannot read the tables.

## Study

Reviews use [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) (the scheduler Anki uses) with a 90% recall target and short learning steps. Due learning cards come first, then reviews, then up to 20 new words a day. New words are the most frequent ones you have not studied in that level.

A word is shaky while it is still in learning, after two or more lapses, or when a young card was missed. A word is mastered once it is in review with at least 21 days of memory stability.

## Vocabulary

`data/words.json` is built from:

- FLELex / Beacco, Université catholique de Louvain, CC BY-NC-SA 4.0. François, Gala, Watrin & Fairon, LREC 2014. Pintard & François, READI 2020.
- English glosses from the MUSE French–English dictionary, Facebook Research, CC BY-NC 4.0, with learner corrections for closed-class and ambiguous words.

The derived word list is CC BY-NC-SA 4.0. Rebuild it with `npm run build:vocab` after placing `FleLex_TT_Beacco.tsv`, `fr-en.txt`, and `en-10k.txt` in `data/raw/`.

## Reader

Uploading a PDF stores it in `data/readings` and segments page 1. Later pages are segmented only when you ask. The extracted text of that single page is sent to OpenAI, which returns phrase-sized French with English translations. Click a phrase to open the meaning.

Scanned pages without a text layer cannot be segmented.
