const https = require('https');
const path = require('path');
const fs = require('fs');

const baseDir = path.dirname(require.main.filename);

let words = [];

const defaultWordsData = `chocolate
iguana
cardigan
enormous
gargantuan
orangutan
oranges
cookies
steak
monstera
dessert
daisy
bouquet
grapefruit
blueberry
sweet
plumage
mango
elephant
musk
succulent
bamboo
pepper
brick
bloom
brother
sheesh
sapphire
papaya
balls
grip
annihilate
cake
gooch
bust
shoal
parasaurolophus
aubergine
buns
scruff
worcestershire
extant
basal
glossy
slick
water
gulp
timid
equate
illustrious
simple
queasy
giraffe
superfluous
waffle
cream
quake
twist
stump
lilly
turquoise
supposed
tickle
aquatic
goblin
rat
bastard
cacophony
obliterate
chop
schmove
clown
serendipitous
crack
brainlet
hog
stummy
buddy
void
funky
peepee
ephemeral
hotdog
savage
derives
blatant
disarray
lurking
brutal
spectral
sinister
degenerate
unprecedented
cryptic
solitude
blitzkrieg
obscurity
frigid
decay
decadence
vanity
supremacy
apathy
inquisition
endurance
disarray
ostracized
proper
prosper
conspiracy
militant
mentality
apocalypse
apparition
cache
cascade
coherent
conflict
congregate
cringe
dated
deceit
decompose
decline
decrepit
delusional
demoralized
detonate
destitute
domain
ebony
elegant
essence
euphoria
facade
fabricate
fidelity
latitude`;

const defaultWords = defaultWordsData.split(/\s+/);

// need to move to squish
const options = [process.cwd(), require.main.filename, process.mainModule.filename, __dirname];

let dictPath;

for (let i = 0; i < options.length; i++) {
    if (fs.existsSync(`${options[i]}/dictionary.txt`)) {
        dictPath = `${options[i]}/dictionary.txt`;
        break;
    }
}

if (dictPath) {
    console.log('Using dictionary file at ' + dictPath);
    const dictionaryBytes = fs.readFileSync(dictPath);
    words = dictionaryBytes.toString().split('\n').filter(w => !!w);
} else {
    console.log('Missing dictionary.txt file. Using default dictionary');
    words = defaultWords;
}

const dictionary = {
    length: () => words.length,
    
    get: (index) => words[index],
    
    random: () => words[Math.floor(Math.random() * words.length)]
};

module.exports = dictionary;
