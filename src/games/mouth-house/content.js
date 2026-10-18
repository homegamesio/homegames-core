'use strict';

const PLACES = ['Moon', 'Haunted', 'Disco'];
const THINGS = ['soap', 'sock', 'cheese', 'tooth', 'tea', 'worm'];
const MOODS = ['POLITE', 'FERAL', 'SLEEPY'];
const FOODS = PLACES.flatMap((place, p) => THINGS.flatMap((thing, t) => MOODS.map((mood, m) => ({
    id: `${p}-${t}-${m}`, name: `${place} ${thing}`, place: p, thing: t, mood: m,
}))));
const COURSE_NAMES = ['A little nibble', 'Something suspicious', 'The main event', 'A palate cleanser', 'One last bad idea'];
const TITLES = ['Duke of the Sock Drawer', 'Minister of Tiny Problems', 'The Forbidden Roommate',
    'Professor of Second Dinner', 'Your Local Moon Goblin', 'The Dishwasher Oracle',
    'A Very Damp Celebrity', 'Mayor of Absolutely Nothing', 'The Cosmic Freeloader'];
const GOOD = ['Yes. This tastes like rent.', 'My bones are applauding.', 'A perfectly illegal texture.',
    'I can hear a new color.', 'Compliments to the floor.'];
const BAD = ['BURP. My lawyer says no.', 'BURP. Too much reality.', 'BURP. Deeply un-mouthlike.',
    'BURP. That tastes like Tuesday.'];

function shuffle(values, random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function clueText(rule) {
    const { dimension: d, value: v, not } = rule;
    if (d === 'place') return not
        ? ['Nothing from the moon.', 'Nothing haunted, please.', 'Absolutely no disco.'][v]
        : ['It must come from the moon.', 'It must be haunted.', 'It must come from the disco.'][v];
    if (d === 'thing') return `${not ? 'No' : 'Only'} ${THINGS[v]}, please.`;
    return not ? ['No polite food.', 'Nothing feral.', 'Nothing sleepy.'][v]
        : ['It must be polite.', 'It must be feral.', 'It must be sleepy.'][v];
}
const matchesRule = (food, rule) => rule.not ? food[rule.dimension] !== rule.value : food[rule.dimension] === rule.value;
const matches = (food, rules) => rules.every(rule => matchesRule(food, rule));

// Every clue matters: include a near miss that fails ONLY that clue. The deck
// always contains exactly one solution, even when later requests use negation.
function makeCourse(number, random = Math.random) {
    const target = FOODS[Math.floor(random() * FOODS.length)];
    const dimensions = number < 2 ? ['place', 'thing'] : ['place', 'thing', 'mood'];
    const rules = dimensions.map(dimension => {
        const limit = dimension === 'thing' ? THINGS.length : 3;
        const not = number >= 3 && random() < .45;
        const value = not ? (target[dimension] + 1 + Math.floor(random() * (limit - 1))) % limit : target[dimension];
        const rule = { dimension, value, not }; rule.text = clueText(rule); return rule;
    });
    const candidates = shuffle(FOODS.filter(f => !matches(f, rules)), random), deck = [target];
    const distinct = food => !deck.some(f => f.id === food.id || (number < 2 && f.name === food.name));
    for (let i = 0; i < rules.length; i++) {
        const food = candidates.find(f => distinct(f) && !matchesRule(f, rules[i]) && rules.every((r, j) => i === j || matchesRule(f, r)));
        if (food) deck.push(food);
    }
    for (const food of candidates) { if (deck.length === 6) break; if (distinct(food)) deck.push(food); }
    return { rules, deck: shuffle(deck, random), rejected: [], shared: [], number };
}
function privateRules(course, playerIds, id) {
    const seat = playerIds.indexOf(id);
    if (seat < 0) return [];
    if (playerIds.length === 1) return course.rules.map((_, i) => i);
    const own = course.rules.map((_, i) => i).filter(i => i % playerIds.length === seat);
    return own.length ? own : [seat % course.rules.length];
}
function readSave(data) {
    const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000) : 0;
    return { version: 1, dinners: count(data?.dinners), best: Math.min(6, count(data?.best)),
        collection: Array.isArray(data?.collection) ? [...new Set(data.collection.filter(i => Number.isInteger(i) && i >= 0 && i < TITLES.length))] : [] };
}
module.exports = { PLACES, THINGS, MOODS, FOODS, COURSE_NAMES, TITLES, GOOD, BAD, makeCourse, matches, matchesRule, privateRules, readSave };
