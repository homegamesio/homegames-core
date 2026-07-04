// Each category has exactly 16 words (one 4x4 grid), all 12 chars or fewer.
const WORD_BANK = [
    {
        category: 'ANIMALS',
        words: ['ELEPHANT', 'PENGUIN', 'OCTOPUS', 'KANGAROO', 'GIRAFFE', 'DOLPHIN', 'EAGLE', 'SNAKE',
            'RABBIT', 'TIGER', 'SPIDER', 'WHALE', 'OWL', 'FROG', 'CAMEL', 'WOLF']
    },
    {
        category: 'FOOD',
        words: ['PIZZA', 'SUSHI', 'TACOS', 'PANCAKES', 'POPCORN', 'SPAGHETTI', 'ICE CREAM', 'BURGER',
            'SALAD', 'DONUT', 'SOUP', 'CHEESE', 'BACON', 'MANGO', 'WAFFLE', 'NOODLES']
    },
    {
        category: 'PLACES',
        words: ['BEACH', 'AIRPORT', 'LIBRARY', 'HOSPITAL', 'CASINO', 'MUSEUM', 'FARM', 'DESERT',
            'CASTLE', 'SUBWAY', 'GYM', 'CHURCH', 'PRISON', 'MALL', 'VOLCANO', 'IGLOO']
    },
    {
        category: 'JOBS',
        words: ['PILOT', 'CHEF', 'DENTIST', 'FIREFIGHTER', 'PLUMBER', 'TEACHER', 'LAWYER', 'FARMER',
            'BARBER', 'ASTRONAUT', 'MAGICIAN', 'NURSE', 'DJ', 'SPY', 'CLOWN', 'JUDGE']
    },
    {
        category: 'SPORTS',
        words: ['SOCCER', 'TENNIS', 'BOWLING', 'SURFING', 'BOXING', 'GOLF', 'HOCKEY', 'KARATE',
            'ARCHERY', 'SKIING', 'YOGA', 'DARTS', 'RUGBY', 'FENCING', 'ROWING', 'CHESS']
    },
    {
        category: 'CHARACTERS',
        words: ['PIRATE', 'ZOMBIE', 'ROBOT', 'WIZARD', 'VAMPIRE', 'ALIEN', 'SUPERHERO', 'DETECTIVE',
            'COWBOY', 'NINJA', 'MERMAID', 'DRAGON', 'GHOST', 'WEREWOLF', 'KNIGHT', 'WITCH']
    },
    {
        category: 'AROUND HOME',
        words: ['TOASTER', 'PILLOW', 'MIRROR', 'LADDER', 'CANDLE', 'VACUUM', 'BLANKET', 'SCISSORS',
            'KETTLE', 'DOORBELL', 'BATHTUB', 'FRIDGE', 'UMBRELLA', 'CLOCK', 'LAMP', 'BROOM']
    },
    {
        category: 'INSTRUMENTS',
        words: ['GUITAR', 'PIANO', 'DRUMS', 'VIOLIN', 'TRUMPET', 'FLUTE', 'HARP', 'BANJO',
            'TUBA', 'SAXOPHONE', 'ACCORDION', 'CELLO', 'HARMONICA', 'UKULELE', 'BAGPIPES', 'TRIANGLE']
    },
    {
        category: 'NATURE',
        words: ['RAINBOW', 'THUNDER', 'BLIZZARD', 'TORNADO', 'SUNSHINE', 'WATERFALL', 'GLACIER', 'MEADOW',
            'CORAL REEF', 'QUICKSAND', 'GEYSER', 'CANYON', 'JUNGLE', 'SWAMP', 'DUNE', 'AURORA']
    },
    {
        category: 'SUPERPOWERS',
        words: ['FLIGHT', 'INVISIBILITY', 'TELEPATHY', 'TIME TRAVEL', 'SUPER SPEED', 'X-RAY VISION', 'SHAPESHIFT', 'FIRE BREATH',
            'IMMORTALITY', 'TELEKINESIS', 'LASER EYES', 'FORCE FIELD', 'HEALING', 'MIND CONTROL', 'GIANT SIZE', 'STRETCHING']
    }
];

module.exports = WORD_BANK;
