'use strict';

const TICK_RATE = 10;
const MAX_PLAYERS = 6;
const PHASE_SECONDS = Object.freeze({ prep: 20, perform: 30, vote: 15, reveal: 10 });

// Every set offers equally silly possibilities. The prop is always something
// the performer already has nearby, or can simply pretend to hold.
const prompt = (category, choices) => Object.freeze({
    category,
    choices: Object.freeze(choices.map(([label, brief, a, b]) => Object.freeze({
        label, brief, taboo: Object.freeze([a, b])
    })))
});

const PROMPTS = Object.freeze([
    prompt('PET DEPARTMENT', [
        ['Cat translator', 'Sell a gadget that explains what a cat is complaining about.', 'cat', 'translate'],
        ['Hamster gym', 'Sell a complete fitness center for a very ambitious hamster.', 'hamster', 'exercise'],
        ['Dog thought reader', 'Sell a device that reveals the brilliant ideas inside a dog.', 'dog', 'mind'],
        ['Goldfish taxi', 'Sell a first-class transport service for a goldfish on the go.', 'fish', 'taxi']
    ]),
    prompt('WEATHER DESK', [
        ['Pocket sunshine', 'Sell a way to carry a little sunshine into gloomy situations.', 'sun', 'light'],
        ['Personal rain cloud', 'Sell a tiny cloud that follows you and waters things on request.', 'rain', 'cloud'],
        ['Wind remote', 'Sell a controller that tells the breeze which way to blow.', 'wind', 'remote'],
        ['Snowflake printer', 'Sell a machine that makes designer snowflakes for special occasions.', 'snow', 'print']
    ]),
    prompt('SLEEP LAB', [
        ['Dream recorder', 'Sell a device that saves your dreams so you can watch them at breakfast.', 'dream', 'record'],
        ['Snore orchestra', 'Sell a device that turns loud sleeping noises into beautiful music.', 'snore', 'music'],
        ['Pillow fluffer', 'Sell a luxury gadget that keeps every pillow perfectly fluffy.', 'pillow', 'fluff'],
        ['Bedtime time machine', 'Sell a shortcut that takes tired people straight to bedtime.', 'sleep', 'time']
    ]),
    prompt('KITCHEN OF TOMORROW', [
        ['Toast fortune teller', 'Sell a gadget that predicts your future using breakfast toast.', 'toast', 'future'],
        ['Soup cooling wand', 'Sell a magic tool that brings hot soup to the perfect temperature.', 'soup', 'cool'],
        ['Pasta untangler', 'Sell a rescue device for hopelessly tangled spaghetti.', 'pasta', 'tangle'],
        ['Leftover matchmaker', 'Sell a service that pairs lonely leftovers into a wonderful dinner.', 'leftovers', 'match']
    ]),
    prompt('SOCIAL SURVIVAL', [
        ['Awkward silence alarm', 'Sell an alarm that warns you when a conversation is about to go quiet.', 'awkward', 'silence'],
        ['Compliment dispenser', 'Sell a machine that gives out the perfect kind words on demand.', 'compliment', 'nice'],
        ['Small talk compass', 'Sell a navigation tool that steers conversations toward interesting topics.', 'talk', 'compass'],
        ['Excuse generator', 'Sell a gadget that invents graceful reasons to leave boring situations.', 'excuse', 'leave']
    ]),
    prompt('SPACE SHOP', [
        ['Moon dust vacuum', 'Sell a cleaner for astronauts with terribly dusty living rooms.', 'moon', 'vacuum'],
        ['Alien doorbell', 'Sell a doorbell that makes visitors from other planets feel welcome.', 'alien', 'bell'],
        ['Zero-gravity haircut', 'Sell a tool for a stylish haircut while floating in a spaceship.', 'hair', 'gravity'],
        ['Comet parking meter', 'Sell a meter that keeps fast-moving space rocks from parking too long.', 'comet', 'parking']
    ]),
    prompt('GARDEN GADGETS', [
        ['Plant cheerleader', 'Sell a device that encourages shy houseplants to grow.', 'plant', 'cheer'],
        ['Worm traffic lights', 'Sell a traffic system for busy underground commuters.', 'worm', 'traffic'],
        ['Flower perfume coach', 'Sell a device that teaches flowers how to smell more impressive.', 'flower', 'smell'],
        ['Snail race starter', 'Sell an exciting starter kit for the slowest sporting event in town.', 'snail', 'race']
    ]),
    prompt('FASHION EMERGENCY', [
        ['Sock reunion service', 'Sell a service that reunites socks separated by the laundry.', 'sock', 'pair'],
        ['Hat confidence boost', 'Sell a gadget that makes any hat feel like a bold fashion choice.', 'hat', 'confidence'],
        ['Invisible cape', 'Sell a cape that makes its wearer feel heroic without showing any fabric.', 'cape', 'invisible'],
        ['Shoe applause machine', 'Sell shoes that give you a standing ovation with every step.', 'shoe', 'clap']
    ]),
    prompt('OFFICE UPGRADES', [
        ['Meeting fast-forward', 'Sell a device that skips straight to the end of a long meeting.', 'meeting', 'skip'],
        ['Keyboard snack shield', 'Sell a tool that protects a computer from enthusiastic snacking.', 'keyboard', 'crumb'],
        ['Desk vacation portal', 'Sell a tiny getaway that fits right on a crowded desk.', 'desk', 'vacation'],
        ['Printer whisperer', 'Sell a tool that gently persuades stubborn printers to cooperate.', 'printer', 'paper']
    ]),
    prompt('ROYAL NECESSITIES', [
        ['Crown polisher', 'Sell a luxury gadget that keeps a royal crown dazzling.', 'crown', 'shine'],
        ['Dragon breath mint', 'Sell a breath freshener for the castle dragon.', 'dragon', 'breath'],
        ['Throne warmer', 'Sell a gadget that takes the chill out of royal seating.', 'throne', 'warm'],
        ['Royal wave trainer', 'Sell a device that teaches the perfect greeting for a royal parade.', 'royal', 'wave']
    ]),
    prompt('TRAVEL ESSENTIALS', [
        ['Suitcase shrinking ray', 'Sell a tool that makes overpacked luggage tiny enough to carry.', 'suitcase', 'shrink'],
        ['Queue jumper boots', 'Sell boots that make waiting in a long line feel wonderfully short.', 'queue', 'boots'],
        ['Beach sand repeller', 'Sell a gadget that tells beach sand to stay out of your belongings.', 'sand', 'beach'],
        ['Tourist pigeon guide', 'Sell a tour service led by a pigeon who knows all the best landmarks.', 'pigeon', 'guide']
    ]),
    prompt('TINY LUXURIES', [
        ['Ant spa', 'Sell a luxury relaxation resort for hardworking ants.', 'ant', 'spa'],
        ['Butterfly luggage', 'Sell stylish travel bags for butterflies taking a long trip.', 'butterfly', 'bag'],
        ['Ladybug sunglasses', 'Sell designer eyewear for fashionable ladybugs.', 'ladybug', 'glasses'],
        ['Bee karaoke booth', 'Sell a private singing booth where bees can practice their greatest hits.', 'bee', 'sing']
    ]),
    prompt('HOME IMPROVEMENTS', [
        ['Door squeak tuner', 'Sell a gadget that turns a squeaky door into a pleasant melody.', 'door', 'squeak'],
        ['Dust bunny shepherd', 'Sell a tool that rounds up fluffy dust creatures under furniture.', 'dust', 'bunny'],
        ['Couch treasure finder', 'Sell a detector for the lost riches hidden inside a sofa.', 'couch', 'treasure'],
        ['Mirror pep talk', 'Sell a mirror that gives its owner an encouraging speech each morning.', 'mirror', 'reflect']
    ]),
    prompt('PARTY DEPARTMENT', [
        ['Confetti collector', 'Sell a device that gathers every scrap after a spectacular celebration.', 'confetti', 'clean'],
        ['Balloon dance coach', 'Sell a coach that teaches party balloons impressive dance moves.', 'balloon', 'dance'],
        ['Cake security system', 'Sell an alarm that protects a celebration cake from sneaky fingers.', 'cake', 'alarm'],
        ['Disco plant pot', 'Sell a flowerpot that throws a tiny dance party for your greenery.', 'disco', 'pot']
    ]),
    prompt('OCEAN OUTLET', [
        ['Octopus mittens', 'Sell cozy winter wear for a creature with eight busy arms.', 'octopus', 'mitten'],
        ['Shark smile kit', 'Sell a kit that gives a shark a friendly, camera-ready grin.', 'shark', 'teeth'],
        ['Jellyfish nightlight', 'Sell a soothing bedside lamp designed for jellyfish bedrooms.', 'jellyfish', 'light'],
        ['Crab dance shoes', 'Sell footwear that makes sideways dancing look spectacular.', 'crab', 'shoe']
    ]),
    prompt('BREAKFAST CLUB', [
        ['Cereal lifeguard', 'Sell a rescue gadget for cereal that is getting too soggy.', 'cereal', 'rescue'],
        ['Pancake trampoline', 'Sell a bouncy device that flips pancakes with athletic flair.', 'pancake', 'bounce'],
        ['Egg motivational coach', 'Sell a coach that persuades shy eggs to become a great breakfast.', 'egg', 'coach'],
        ['Jam traffic controller', 'Sell a tool that directs spreads neatly across your breakfast.', 'jam', 'spread']
    ]),
    prompt('LOST AND FOUND', [
        ['Key homing beacon', 'Sell a gadget that calls lost keys back home like trained birds.', 'key', 'find'],
        ['Remote control leash', 'Sell a device that stops the television controller from wandering away.', 'remote', 'leash'],
        ['Glasses locator', 'Sell a way to locate spectacles even when they are on your own head.', 'glasses', 'head'],
        ['Thought boomerang', 'Sell a device that brings back the idea you just completely forgot.', 'thought', 'remember']
    ]),
    prompt('FANTASY FITNESS', [
        ['Wizard stretch class', 'Sell a workout that keeps spell-casting arms flexible.', 'wizard', 'stretch'],
        ['Unicorn treadmill', 'Sell exercise equipment for a magical horse stuck indoors.', 'unicorn', 'run'],
        ['Mermaid step counter', 'Sell a fitness tracker for someone who swims everywhere.', 'mermaid', 'step'],
        ['Giant skipping rope', 'Sell a workout tool for a giant with a surprisingly small garden.', 'giant', 'rope']
    ]),
    prompt('BATHROOM BREAKTHROUGHS', [
        ['Shower concert stage', 'Sell a stage that turns a daily wash into a headline performance.', 'shower', 'sing'],
        ['Toothbrush dance tutor', 'Sell a tutor that makes brushing teeth a graceful routine.', 'toothbrush', 'dance'],
        ['Towel hug machine', 'Sell a gadget that gives people a warm, fluffy embrace after washing.', 'towel', 'hug'],
        ['Soap escape catcher', 'Sell a tool that catches slippery soap before it makes a getaway.', 'soap', 'slip']
    ]),
    prompt('TIME SAVERS', [
        ['Weekend extender', 'Sell a device that adds a little more leisure to your weekend.', 'weekend', 'longer'],
        ['Monday snooze button', 'Sell a button that delays the start of the working week.', 'Monday', 'snooze'],
        ['Chore fast-forward', 'Sell a gadget that makes dull household tasks fly by.', 'chore', 'fast'],
        ['Birthday pause remote', 'Sell a way to keep the best moment of a birthday party going.', 'birthday', 'pause']
    ]),
    prompt('NEIGHBORHOOD NEWS', [
        ['Mailbox storyteller', 'Sell a mailbox that dramatically narrates every delivery.', 'mail', 'story'],
        ['Fence gossip filter', 'Sell a device that turns neighborhood gossip into kind conversation.', 'fence', 'gossip'],
        ['Lawn applause sign', 'Sell a sign that celebrates anyone who walks past your garden.', 'lawn', 'clap'],
        ['Doormat talent judge', 'Sell a welcome mat that rates the flair of every entrance.', 'mat', 'judge']
    ]),
    prompt('ARTS AND CRAFTS', [
        ['Crayon mood matcher', 'Sell a tool that chooses the perfect drawing color for your feelings.', 'crayon', 'color'],
        ['Glitter escape room', 'Sell a clever trap that keeps craft sparkle from taking over the house.', 'glitter', 'trap'],
        ['Paper airplane pilot', 'Sell an autopilot for homemade flying creations.', 'paper', 'plane'],
        ['Paintbrush hair salon', 'Sell a styling service for brushes having a bad bristle day.', 'brush', 'hair']
    ]),
    prompt('SPORTING NONSENSE', [
        ['Competitive napping', 'Sell equipment for becoming a champion at taking a little rest.', 'nap', 'sleep'],
        ['Extreme slow walking', 'Sell gear for a thrilling sport where nobody is in a hurry.', 'slow', 'walk'],
        ['Invisible table tennis', 'Sell a thrilling tabletop game with equipment nobody can see.', 'invisible', 'tennis'],
        ['Synchronized snacking', 'Sell a training tool for a team that eats in perfect coordination.', 'snack', 'together']
    ]),
    prompt('FEEL-GOOD INVENTIONS', [
        ['Pocket cheering crowd', 'Sell a tiny audience that celebrates your everyday achievements.', 'crowd', 'cheer'],
        ['Worry bubble blower', 'Sell a gadget that floats little worries away into the sky.', 'worry', 'bubble'],
        ['Happy memory projector', 'Sell a device that shows your favorite moments on any wall.', 'memory', 'project'],
        ['Emergency giggle kit', 'Sell a small rescue kit for a day that needs a burst of laughter.', 'giggle', 'laugh']
    ])
]);

const validId = id => (Number.isSafeInteger(id) && id >= 0)
    || (typeof id === 'string' && id.trim().length > 0 && id.length <= 100);

class ShowboatRules {
    constructor({ random = Math.random } = {}) {
        this.random = typeof random === 'function' ? random : Math.random;
        this.people = new Map();
        this.hostId = null;
        this.mode = 'room';
        this.phase = 'lobby';
        this.roster = [];
        this.queue = [];
        this.current = null;
        this.roundNumber = 0;
        this.totalRounds = 0;
        this.remainingTicks = 0;
        this._prompts = [];
    }

    get secondsLeft() {
        return Math.ceil(this.remainingTicks / TICK_RATE);
    }

    addPlayer(id, name) {
        if (!validId(id) || this.people.has(id) || this.people.size >= MAX_PLAYERS) return false;
        const cleanName = typeof name === 'string' ? name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 18) : '';
        this.people.set(id, { name: cleanName || `Player ${this.people.size + 1}`, score: 0 });
        if (this.hostId === null) this.hostId = id;
        return true;
    }

    removePlayer(id) {
        if (!this.people.delete(id)) return false;
        this.roster = this.roster.filter(pid => pid !== id);
        this.queue = this.queue.filter(pid => pid !== id);
        if (this.hostId === id) this.hostId = this.people.size ? this.people.keys().next().value : null;
        if (this.phase === 'lobby' || this.phase === 'finished') return true;
        if (this.roster.length < 2) {
            this._lobby();
            return true;
        }
        this.totalRounds = this.roundNumber + this.queue.length;
        if (this.current) {
            this.current.voters = this.current.voters.filter(pid => pid !== id);
            this.current.votes.delete(id);
            // A completed reveal keeps the points already awarded. An interrupted
            // pitch is discarded and never awards a partial round's points.
            if (this.current.performerId === id && this.phase !== 'reveal') this._nextRound();
            else if (this.phase === 'vote' && this.current.votes.size === this.current.voters.length) this._reveal();
        }
        return true;
    }

    setMode(id, mode) {
        if (!this.people.has(id) || id !== this.hostId || this.phase !== 'lobby'
            || !['room', 'remote'].includes(mode) || mode === this.mode) return false;
        this.mode = mode;
        return true;
    }

    start(id) {
        if (!this.people.has(id) || id !== this.hostId || this.phase !== 'lobby' || this.people.size < 2) return false;
        this.roster = [...this.people.keys()];
        this.queue = [...this.roster, ...this.roster];
        this.totalRounds = this.queue.length;
        this.roundNumber = 0;
        this.people.forEach(person => { person.score = 0; });
        this._prompts = [...PROMPTS];
        for (let i = this._prompts.length - 1; i > 0; i--) {
            const j = this._randomIndex(i + 1);
            [this._prompts[i], this._prompts[j]] = [this._prompts[j], this._prompts[i]];
        }
        this._nextRound();
        return true;
    }

    advance(id) {
        if (!this.people.has(id)) return false;
        if (id === this.hostId && this.phase === 'finished') {
            this._lobby();
            return true;
        }
        if (id === this.hostId && this.phase === 'reveal') {
            this._nextRound();
            return true;
        }
        if (!this.current || id !== this.current.performerId) return false;
        if (this.phase === 'prep') this._phase('perform');
        else if (this.phase === 'perform') this._phase('vote');
        else return false;
        return true;
    }

    vote(id, index) {
        if (this.phase !== 'vote' || !this.people.has(id) || !this.current.voters.includes(id)
            || !Number.isInteger(index) || index < 0 || index >= 4 || this.current.votes.has(id)) return false;
        this.current.votes.set(id, index);
        if (this.current.votes.size === this.current.voters.length) this._reveal();
        return true;
    }

    tick() {
        if (!this.remainingTicks) return false;
        const before = this.secondsLeft;
        this.remainingTicks--;
        if (this.remainingTicks > 0) return before !== this.secondsLeft;
        if (this.phase === 'prep') this._phase('perform');
        else if (this.phase === 'perform') this._phase('vote');
        else if (this.phase === 'vote') this._reveal();
        else if (this.phase === 'reveal') this._nextRound();
        return true;
    }

    // Keep answers out of a shared rendering model, including the host's view.
    // Return copies so callers cannot change the authoritative game through it.
    viewFor(id) {
        const view = {
            hostId: this.hostId, mode: this.mode, phase: this.phase,
            roundNumber: this.roundNumber, totalRounds: this.totalRounds,
            secondsLeft: this.secondsLeft,
            people: [...this.people].map(([pid, person]) => ({ id: pid, ...person })),
            participant: this.roster.includes(id),
            current: null
        };
        if (!this.current) return view;
        const round = this.current;
        const revealed = this.phase === 'reveal' || this.phase === 'finished';
        view.current = {
            performerId: round.performerId,
            category: round.prompt.category,
            choices: round.prompt.choices.map(choice => choice.label),
            voters: [...round.voters],
            voteCount: round.votes.size,
            eligible: round.voters.includes(id),
            voted: round.votes.has(id),
            ownVote: round.votes.has(id) ? round.votes.get(id) : null
        };
        if (id === round.performerId || revealed) {
            const choice = round.prompt.choices[round.correctIndex];
            view.current.secret = { ...choice, taboo: [...choice.taboo], correctIndex: round.correctIndex };
        }
        if (revealed && round.result) {
            view.current.result = {
                ...round.result,
                correctVoterIds: [...round.result.correctVoterIds],
                votes: round.result.votes.map(vote => ({ ...vote }))
            };
        }
        return view;
    }

    _randomIndex(length) {
        const value = this.random();
        return Math.min(length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * length)));
    }

    _phase(phase) {
        this.phase = phase;
        this.remainingTicks = (PHASE_SECONDS[phase] || 0) * TICK_RATE;
    }

    _nextRound() {
        if (!this.queue.length) {
            this._phase('finished');
            return;
        }
        const performerId = this.queue.shift();
        const correctIndex = this._randomIndex(4);
        this.roundNumber++;
        this.current = {
            performerId,
            prompt: { ...this._prompts.pop(), correctIndex },
            correctIndex,
            voters: this.roster.filter(id => id !== performerId && this.people.has(id)),
            votes: new Map()
        };
        this._phase('prep');
    }

    _reveal() {
        const round = this.current;
        if (!round || round.result) return;
        const correctVoterIds = round.voters.filter(id => round.votes.get(id) === round.correctIndex);
        correctVoterIds.forEach(id => { this.people.get(id).score += 100; });
        const performerPoints = correctVoterIds.length * 100;
        const performer = this.people.get(round.performerId);
        if (performer) performer.score += performerPoints;
        round.result = {
            correctIndex: round.correctIndex, correctVoterIds, performerPoints,
            votes: [...round.votes].map(([id, index]) => ({ id, index }))
        };
        this._phase('reveal');
    }

    _lobby() {
        this._phase('lobby');
        this.roster = [];
        this.queue = [];
        this.current = null;
        this.roundNumber = 0;
        this.totalRounds = 0;
        this._prompts = [];
        this.people.forEach(person => { person.score = 0; });
    }
}

ShowboatRules.PROMPTS = PROMPTS;
ShowboatRules.TICK_RATE = TICK_RATE;
ShowboatRules.MAX_PLAYERS = MAX_PLAYERS;
ShowboatRules.PHASE_SECONDS = PHASE_SECONDS;

module.exports = ShowboatRules;
