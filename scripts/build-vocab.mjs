/**
 * Builds data/words.json from two public sources:
 *
 * 1. FLELex / Beacco (UCLouvain, CC BY-NC-SA 4.0)
 *    CEFR levels for French as a foreign language.
 *    François, Gala, Watrin & Fairon, LREC 2014.
 *    Pintard & François, READI 2020.
 *    https://cental.uclouvain.be/cefrlex/flelex/
 *
 * 2. MUSE French–English dictionary (Facebook Research, CC BY-NC 4.0)
 *    https://github.com/facebookresearch/MUSE
 *
 * Closed-class words and a few ambiguous lemmas are corrected for learners.
 * The derived file is shared under CC BY-NC-SA 4.0.
 *
 * Place the downloads in data/raw/:
 *   FleLex_TT_Beacco.tsv
 *   fr-en.txt
 *   en-10k.txt  (Google 10k English list, used only to rank glosses)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CAP = { A1: 800, A2: 800, B1: 700, B2: 600, C1: 500, C2: 400 };
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WORD = /^[a-zàâäæçéèêëïîôœùûüÿ]+(?:['-][a-zàâäæçéèêëïîôœùûüÿ]+)*$/;

/** Learner glosses that statistical alignment gets wrong or misses. */
const OVERRIDES = {
	le: 'the',
	la: 'the',
	les: 'the',
	un: 'a, one',
	une: 'a, one',
	de: 'of, from',
	des: 'some',
	du: 'of the, some',
	au: 'to the',
	aux: 'to the',
	et: 'and',
	ou: 'or',
	où: 'where',
	à: 'at, to',
	en: 'in',
	y: 'there',
	ne: 'not',
	pas: 'not',
	que: 'that',
	qui: 'who, which',
	quoi: 'what',
	dont: 'of which',
	ce: 'this, that',
	cet: 'this, that',
	cette: 'this, that',
	ces: 'these, those',
	se: 'oneself',
	me: 'me',
	te: 'you',
	moi: 'me',
	toi: 'you',
	lui: 'him, her',
	nous: 'we, us',
	vous: 'you',
	je: 'I',
	tu: 'you',
	il: 'he, it',
	elle: 'she, it',
	ils: 'they',
	elles: 'they',
	on: 'one, we',
	mon: 'my',
	ma: 'my',
	mes: 'my',
	ton: 'your',
	ta: 'your',
	tes: 'your',
	son: 'his, her',
	sa: 'his, her',
	ses: 'his, her',
	notre: 'our',
	nos: 'our',
	votre: 'your',
	vos: 'your',
	leur: 'their',
	leurs: 'their',
	être: 'to be',
	avoir: 'to have',
	faire: 'to do, to make',
	aller: 'to go',
	dire: 'to say',
	pouvoir: 'can, to be able to',
	vouloir: 'to want',
	savoir: 'to know',
	voir: 'to see',
	venir: 'to come',
	devoir: 'must, to have to',
	prendre: 'to take',
	mettre: 'to put',
	donner: 'to give',
	falloir: 'to be necessary',
	parler: 'to speak',
	aimer: 'to like, to love',
	manger: 'to eat',
	boire: 'to drink',
	temps: 'time, weather',
	'livre|NOM': 'book',
	'livre|VER': 'to deliver',
	homme: 'man',
	femme: 'woman',
	enfant: 'child',
	petit: 'small',
	grand: 'big, tall',
	bon: 'good',
	bien: 'well',
	mal: 'badly',
	plus: 'more',
	moins: 'less',
	peu: 'little, few',
	beaucoup: 'a lot',
	trop: 'too much',
	assez: 'enough',
	très: 'very',
	aussi: 'also',
	tout: 'all',
	même: 'same, even',
	autre: 'other',
	personne: 'person, nobody',
	rien: 'nothing',
	jamais: 'never',
	toujours: 'always',
	encore: 'again, still',
	déjà: 'already',
	ici: 'here',
	là: 'there',
	bonjour: 'hello',
	merci: 'thank you',
	oui: 'yes',
	non: 'no',
	"aujourd'hui": 'today',
	demain: 'tomorrow',
	hier: 'yesterday',
	maintenant: 'now',
	pourquoi: 'why',
	comment: 'how',
	quand: 'when',
	combien: 'how many, how much',
	quel: 'which',
	avec: 'with',
	sans: 'without',
	pour: 'for',
	par: 'by',
	sur: 'on',
	sous: 'under',
	dans: 'in',
	chez: 'at the place of',
	entre: 'between',
	vers: 'toward',
	depuis: 'since',
	pendant: 'during',
	avant: 'before',
	après: 'after',
	mais: 'but',
	donc: 'so',
	car: 'because',
	si: 'if',
	comme: 'like, as',
	eau: 'water',
	jour: 'day',
	nuit: 'night',
	maison: 'house',
	chien: 'dog',
	amour: 'love',
	histoire: 'story, history',
	'avocat|NOM': 'lawyer, avocado',
	'pièce|NOM': 'room, piece',
	'vol|NOM': 'flight, theft',
	voler: 'to fly, to steal',
	'fois|NOM': 'time, occasion',
	fils: 'son',
	disposer: 'to have available',
	assister: 'to attend',
	attendre: 'to wait',
	entendre: 'to hear',
	rester: 'to stay',
	quitter: 'to leave',
	demander: 'to ask',
	sentir: 'to feel',
	porter: 'to carry, to wear',
	vivre: 'to live',
	connaître: 'to know',
	croire: 'to believe',
	écrire: 'to write',
	lire: 'to read',
	sortir: 'to go out',
	partir: 'to leave',
	arriver: 'to arrive',
	entrer: 'to enter',
	tomber: 'to fall',
	appeler: 'to call',
	essayer: 'to try',
	trouver: 'to find',
	chercher: 'to look for',
	travailler: 'to work',
	jouer: 'to play',
	finir: 'to finish',
	ouvrir: 'to open',
	fermer: 'to close',
	commencer: 'to begin',
	écouter: 'to listen',
	regarder: 'to watch, to look at',
	acheter: 'to buy',
	vendre: 'to sell',
	payer: 'to pay',
	utiliser: 'to use',
	devenir: 'to become',
	revenir: 'to come back',
	tenir: 'to hold',
	suivre: 'to follow',
	perdre: 'to lose',
	gagner: 'to win, to earn',
	comprendre: 'to understand',
	apprendre: 'to learn',
	répondre: 'to answer',
	permettre: 'to allow',
	sembler: 'to seem',
	laisser: 'to let, to leave',
	passer: 'to pass, to spend',
	rendre: 'to give back',
	monter: 'to go up',
	descendre: 'to go down',
	lutter: 'to fight, to struggle',
	traverser: 'to cross',
	'travers|NOM': 'fault, breadth',
	'main|NOM': 'hand',
	'coin|NOM': 'corner',
	'chair|NOM': 'flesh',
	'pain|NOM': 'bread',
	librairie: 'bookshop',
	journal: 'newspaper',
	'location|NOM': 'rental',
	déception: 'disappointment',
	'ancien|ADJ': 'former, old',
	actuellement: 'currently',
	'sensible|ADJ': 'sensitive',
	'large|ADJ': 'wide',
	'chance|NOM': 'luck',
	monnaie: 'change, cash',
	'argent|NOM': 'money',
	'cours|NOM': 'class, course',
	'store|NOM': 'window blind',
	blesser: 'to injure',
	ignorer: 'to not know',
	prétendre: 'to claim',
	réaliser: 'to carry out',
	'supporter|VER': 'to bear',
	'user|VER': 'to wear out',
	'souvenir|NOM': 'memory',
	manquer: 'to miss',
	'car|NOM': 'bus',
	'figure|NOM': 'face',
	'affaire|NOM': 'matter, business',
	'caution|NOM': 'deposit',
	entrée: 'entrance, starter',
	'plat|NOM': 'dish',
	'plat|ADJ': 'flat',
	crier: 'to shout',
	pleurer: 'to cry',
	rire: 'to laugh',
	dormir: 'to sleep',
	habiter: 'to live in',
	louer: 'to rent',
	prêter: 'to lend',
	emprunter: 'to borrow',
	recevoir: 'to receive',
	envoyer: 'to send',
	apporter: 'to bring',
	choisir: 'to choose',
	décider: 'to decide',
	espérer: 'to hope',
	oublier: 'to forget',
	servir: 'to serve',
	changer: 'to change',
	tourner: 'to turn',
	retourner: 'to go back',
	'gentil|ADJ': 'kind',
	sympathique: 'nice',
	dépasser: 'to exceed, to overtake'
};

const enRank = new Map();
readFileSync('data/raw/en-10k.txt', 'utf8')
	.trim()
	.split(/\n/)
	.forEach((word, index) => {
		if (!enRank.has(word)) enRank.set(word, index);
	});

const glosses = new Map();
for (const line of readFileSync('data/raw/fr-en.txt', 'utf8').trim().split(/\n/)) {
	const parts = line.trim().split(/\s+/);
	if (parts.length < 2) continue;
	const fr = parts[0].toLowerCase();
	const en = parts.slice(1).join(' ').toLowerCase();
	if (!/^[\p{L}'-]+$/u.test(en)) continue;
	if (en.length === 1 && en !== 'a' && en !== 'i') continue;
	if (!glosses.has(fr)) glosses.set(fr, []);
	const list = glosses.get(fr);
	if (list.length < 12 && !list.includes(en)) list.push(en);
}

function isVariant(a, b) {
	if (a === b) return true;
	const irregular = { men: 'man', women: 'woman', children: 'child' };
	if (irregular[a] === b || irregular[b] === a) return true;
	const stem = (word) => word.replace(/(ing|es|s)$/, '');
	return stem(a).length >= 3 && stem(a) === stem(b);
}

const KEEP_S = new Set(['news', 'series', 'species', 'clothes', 'glasses']);

function singularize(en) {
	if (KEEP_S.has(en) || !en.endsWith('s') || en.endsWith('ss')) return en;
	const cut = en.endsWith('es') && en.length > 4 ? en.slice(0, -2) : en.slice(0, -1);
	return enRank.has(cut) ? cut : en;
}

function infinitive(en) {
	if (!en.endsWith('ing') || en.length < 5) return en;
	const stem = en.slice(0, -3);
	const undoubled = stem.replace(/([bcdfghjklmnpqrstvwxz])\1$/, '$1');
	const options = [stem, `${stem}e`, undoubled, `${undoubled}e`];
	return options.find((word) => enRank.has(word) && word.length > 1) ?? en;
}

function fromMuse(lemma, pos) {
	const options = (glosses.get(lemma) ?? []).filter((en) => en !== lemma || enRank.has(en));
	const ranked = options
		.map((en) => {
			let score = enRank.get(en) ?? 7000;
			if (en === lemma) score += 250;
			if (pos === 'VER' && en.endsWith('ing')) score += 2500;
			if ((pos === 'NOM' || pos === 'ADJ') && en.endsWith('s') && enRank.has(en.slice(0, -1))) {
				score += 800;
			}
			return { en, score };
		})
		.sort((a, b) => a.score - b.score);
	if (!ranked.length) return null;
	const others = ranked.filter((item) => item.en !== lemma && item.score < 5000);
	const best = others[0] ?? ranked[0];
	if (best.en === lemma && !enRank.has(best.en)) return null;
	const second = ranked.find(
		(item) =>
			item.en !== best.en && item.en !== lemma && !isVariant(item.en, best.en) && item.score < 1800
	);
	let chosen = second ? [best.en, second.en] : [best.en];
	if (pos === 'VER') {
		chosen = chosen.map(infinitive);
		return [...new Set(chosen)]
			.map((word) => (word.startsWith('to ') ? word : `to ${word}`))
			.join(', ');
	}
	if (pos === 'NOM' || pos === 'ADJ') chosen = chosen.map(singularize);
	return [...new Set(chosen)].join(', ');
}

function translationFor(lemma, pos) {
	return OVERRIDES[`${lemma}|${pos}`] ?? OVERRIDES[lemma] ?? fromMuse(lemma, pos);
}

const raw = readFileSync('data/raw/FleLex_TT_Beacco.tsv', 'utf8').replace(/^\uFEFF/, '');
const [headerLine, ...lines] = raw.trim().split(/\n/);
const header = headerLine.split('\t').map((cell) => cell.trim());
const best = new Map();

for (const line of lines) {
	const cells = line.split('\t');
	const row = {};
	header.forEach((key, index) => {
		row[key] = (cells[index] ?? '').trim();
	});
	const lemma = row.word?.toLowerCase();
	const pos = row.tag;
	const level = row.level;
	if (!lemma || !WORD.test(lemma) || !LEVELS.includes(level)) continue;
	const translation = translationFor(lemma, pos);
	if (!translation) continue;
	const frequency = Number(row.freq_total);
	const key = `${lemma}\t${pos}`;
	const current = best.get(key);
	if (!current || frequency > current.frequency) {
		best.set(key, {
			lemma,
			pos,
			level,
			translation,
			frequency: Number.isFinite(frequency) ? frequency : 0
		});
	}
}

const words = [];
for (const level of LEVELS) {
	const rows = [...best.values()]
		.filter((row) => row.level === level)
		.sort((a, b) => b.frequency - a.frequency || a.lemma.localeCompare(b.lemma, 'fr'))
		.slice(0, CAP[level]);
	rows.forEach((row, index) => {
		words.push({
			lemma: row.lemma,
			pos: row.pos,
			level,
			translation: row.translation,
			frequency_rank: index + 1
		});
	});
	console.log(
		level,
		rows.length,
		rows
			.slice(0, 8)
			.map((row) => `${row.lemma} (${row.pos}) = ${row.translation}`)
			.join(' | ')
	);
}

const payload = {
	license: 'CC BY-NC-SA 4.0',
	sources: [
		'FLELex / Beacco, Centre de traitement automatique du langage, Université catholique de Louvain. François, Gala, Watrin & Fairon, LREC 2014. Pintard & François, READI 2020. https://cental.uclouvain.be/cefrlex/flelex/',
		'English glosses from the MUSE French–English dictionary, Facebook Research, CC BY-NC 4.0, with learner corrections for closed-class and ambiguous words.'
	],
	words
};

const odd = words.filter((word) => {
	const pieces = word.translation
		.replace(/^to /, '')
		.split(', ')
		.map((part) => part.replace(/^to /, ''));
	const copiesFrench = pieces.some((part) => part === word.lemma && !enRank.has(part));
	return copiesFrench || /(^|, )to \w*ing(,|$)/.test(word.translation);
});
console.log(
	'odd glosses',
	odd.length,
	odd
		.slice(0, 25)
		.map((word) => `${word.lemma} [${word.level}] ${word.translation}`)
		.join(' || ')
);

writeFileSync('data/words.json', JSON.stringify(payload));
console.log('wrote', words.length, 'words');
