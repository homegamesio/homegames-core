const WORLD = { left: 4, right: 119, top: 17, bottom: 75 };

const UNIT_TYPES = {
    ranger: { name: 'Ranger', cost: 35, hp: 74, damage: 10, range: 22, speed: 9, rate: .72, radius: 1.3,
        description: 'Quick rifle squad. Cheap, mobile, captures outposts.' },
    tank: { name: 'Tank', cost: 100, hp: 260, damage: 25, range: 25, speed: 5.2, rate: 1.6, radius: 2.3, splash: 4,
        description: 'Armored spearhead. Shells damage clustered enemies.' },
    medic: { name: 'Medic', cost: 65, hp: 85, damage: 0, range: 16, speed: 8, rate: .65, radius: 1.4, healing: 12,
        description: 'Repairs nearby troops. Keep behind the front line.' },
};

const BUILD_TYPES = {
    turret: { name: 'Turret', cost: 85, hp: 220, damage: 12, range: 25, speed: 0, rate: .6, radius: 2.8,
        description: 'Reliable close defense. Fires fast at nearby raiders.' },
    mortar: { name: 'Mortar', cost: 125, hp: 165, damage: 42, range: 43, speed: 0, rate: 2.5, radius: 3, splash: 7,
        description: 'Long-range shells punish enemy groups.' },
    refinery: { name: 'Refinery', cost: 75, hp: 160, damage: 0, range: 0, speed: 0, rate: 1, radius: 3, income: 3.5,
        description: 'Produces 3.5 credits each battle second. Protect it.' },
};

const ENEMY_TYPES = {
    grunt: { name: 'Raider', hp: 38, damage: 4, range: 11, speed: 5, rate: .95, radius: 1.4, reward: 8 },
    runner: { name: 'Runner', hp: 26, damage: 3.5, range: 4, speed: 8, rate: .48, radius: 1.2, reward: 7 },
    artillery: { name: 'Siege gun', hp: 54, damage: 16, range: 29, speed: 3.8, rate: 2.4, radius: 1.9, splash: 5, reward: 15 },
    tank: { name: 'Iron tank', hp: 130, damage: 11, range: 16, speed: 3.8, rate: 1.6, radius: 2.2, splash: 3.5, reward: 19 },
    boss: { name: 'Dreadnought', hp: 1250, damage: 27, range: 27, speed: 2.5, rate: 1.35, radius: 4.6, splash: 6, reward: 140 },
};

const UPGRADES = [
    { id: 'weapons', name: 'Hot barrels', description: '+20% damage for every unit and defense.' },
    { id: 'range', name: 'Eagle optics', description: '+3 attack and healing range for your entire army.' },
    { id: 'armor', name: 'Field armor', description: '+20% troop and building health. Repairs the added health.' },
    { id: 'supply', name: 'Supply convoy', description: '+4 army capacity and 80 bonus credits.' },
    { id: 'economy', name: 'War bonds', description: '+2 battle credits per second and 50 now.' },
    { id: 'shells', name: 'Shatter shells', description: '+2 shell blast radius and +15% tank and mortar damage.' },
    { id: 'triage', name: 'Combat engineers', description: '+40% medic healing. Receive a free medic if there is room.' },
    { id: 'fortify', name: 'Fortified HQ', description: '+250 HQ health, fully restores that added health.' },
    { id: 'reinforce', name: 'Fresh boots', description: 'Two free rangers and 60 credits. Troops heal 25%.' },
];

const WAVE_NAMES = ['First contact', 'Fast trouble', 'Heavy metal', 'Shell shock', 'Three-front war', 'The Dreadnought'];

module.exports = { WORLD, UNIT_TYPES, BUILD_TYPES, ENEMY_TYPES, UPGRADES, WAVE_NAMES };
