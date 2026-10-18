// Curated for fast recognition and drawability in a mixed workplace group.
// Canonical answers stay short; common alternate names live in WORDS.aliases.
const WORDS = [
    // animals
    'cat', 'dog', 'elephant', 'giraffe', 'penguin', 'shark', 'octopus', 'snake',
    'butterfly', 'spider', 'turtle', 'rabbit', 'owl', 'frog', 'crab', 'whale',
    'bat', 'snail', 'flamingo', 'hedgehog', 'dinosaur', 'monkey', 'pig', 'bee',
    'chicken', 'duck', 'horse', 'cow', 'lion', 'zebra', 'crocodile', 'jellyfish',
    'squirrel', 'dolphin', 'ladybug', 'parrot', 'peacock', 'lobster',

    // food
    'pizza', 'burger', 'taco', 'sushi', 'pancake', 'donut', 'ice cream',
    'hot dog', 'spaghetti', 'popcorn', 'banana', 'watermelon', 'pineapple',
    'cupcake', 'pretzel', 'avocado', 'cheese', 'carrot', 'mushroom', 'egg',
    'cookie', 'sandwich', 'french fries', 'apple', 'strawberry', 'birthday cake',
    'waffle', 'bacon', 'corn', 'lollipop',

    // objects
    'umbrella', 'ladder', 'scissors', 'toothbrush', 'hammer', 'candle',
    'backpack', 'telescope', 'microphone', 'skateboard', 'anchor', 'compass',
    'crown', 'ring', 'guitar', 'piano', 'drum', 'kite', 'balloon', 'robot',
    'rocket', 'lighthouse', 'windmill', 'bridge', 'mailbox', 'toilet',
    'bathtub', 'couch', 'lamp', 'clock', 'key', 'magnet', 'battery', 'dice',
    'trophy', 'eyeglasses', 'mustache', 'scarf', 'boot', 'skeleton', 'brain',
    'camera', 'headphones', 'suitcase', 'broom', 'frying pan', 'watering can',
    'gift', 'paper airplane', 'rubber duck', 'traffic cone', 'treasure chest',
    'flashlight', 'trash can', 'telephone', 'doorbell', 'shopping cart',
    'washing machine', 'traffic light', 'baseball bat',

    // nature
    'volcano', 'rainbow', 'tornado', 'island', 'cactus', 'mountain',
    'waterfall', 'cloud', 'lightning', 'snowman', 'campfire', 'beach',
    'moon', 'star', 'comet', 'tree', 'flower', 'sun', 'palm tree',
    'snowflake', 'wave',

    // actions
    'swimming', 'dancing', 'sleeping', 'fishing', 'juggling', 'skiing',
    'surfing', 'climbing', 'yoga', 'karate', 'bowling', 'sneezing',
    'running', 'waving', 'laughing', 'crying', 'reading', 'cooking',
    'brushing teeth', 'jumping', 'skipping rope', 'lifting weights',

    // places and structures
    'castle', 'igloo', 'pyramid', 'tent', 'barn', 'circus', 'playground',
    'roller coaster', 'ferris wheel', 'farm', 'treehouse', 'haunted house',
    'school bus stop',

    // transport
    'helicopter', 'submarine', 'tractor', 'ambulance', 'canoe', 'scooter',
    'train', 'sailboat', 'bicycle', 'bulldozer', 'car', 'bus', 'airplane',
    'fire truck', 'motorcycle', 'hot air balloon',

    // characters
    'dragon', 'unicorn', 'mermaid', 'vampire', 'ghost', 'zombie', 'wizard',
    'pirate', 'ninja', 'astronaut', 'cowboy', 'clown', 'alien', 'genie',
    'superhero', 'knight', 'chef', 'doctor', 'detective', 'king', 'queen',

    // sports and games
    'basketball', 'soccer ball', 'tennis racket', 'golf club', 'hockey stick',
    'dartboard', 'chess piece', 'boxing gloves', 'baseball', 'football',
    'bowling ball', 'ping pong paddle'
];

WORDS.aliases = Object.freeze({
    rabbit: ['bunny'],
    crocodile: ['alligator'],
    ladybug: ['ladybird'],
    burger: ['hamburger'],
    donut: ['doughnut'],
    'ice cream': ['icecream'],
    'hot dog': ['hotdog'],
    cookie: ['biscuit'],
    'french fries': ['fries'],
    'birthday cake': ['cake'],
    microphone: ['mic'],
    couch: ['sofa'],
    eyeglasses: ['glasses', 'spectacles'],
    mustache: ['moustache'],
    dice: ['die'],
    'frying pan': ['skillet'],
    gift: ['present'],
    'paper airplane': ['paper plane'],
    flashlight: ['torch'],
    'trash can': ['garbage can', 'garbage bin', 'trash bin'],
    telephone: ['phone'],
    'shopping cart': ['trolley'],
    'washing machine': ['washer'],
    'traffic light': ['stoplight'],
    'roller coaster': ['rollercoaster'],
    bicycle: ['bike'],
    sailboat: ['sail boat'],
    airplane: ['plane', 'jet'],
    'fire truck': ['fire engine'],
    canoe: ['kayak'],
    astronaut: ['spaceman'],
    cowboy: ['cowgirl'],
    'soccer ball': ['soccer', 'football'],
    'tennis racket': ['tennis racquet', 'tennis'],
    'golf club': ['golf'],
    'hockey stick': ['hockey'],
    dartboard: ['darts', 'dart board'],
    'chess piece': ['chess'],
    'boxing gloves': ['boxing'],
    'bowling ball': ['bowling'],
    'ping pong paddle': ['ping pong', 'table tennis paddle']
});

module.exports = WORDS;
