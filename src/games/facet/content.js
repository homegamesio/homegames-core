const REALMS = [
    { id: 'atelier', name: 'Luminous Atelier', subtitle: 'Stages 1–10', description: 'Match jewels and create special gems.', color: [244, 202, 128], assetId: 'facet_atelier_v1', keepsake: { name: 'The Sunstone', description: 'Complete the Luminous Atelier.' } },
    { id: 'grotto', name: 'Verdant Grotto', subtitle: 'Stages 11–20', description: 'Combine specials and clear frost.', color: [117, 234, 197], assetId: 'facet_grotto_v1', keepsake: { name: 'The Emerald Bloom', description: 'Complete the Verdant Grotto.' } },
    { id: 'aurora', name: 'Aurora Spire', subtitle: 'Stages 21–30', description: 'Complete color, score, special and frost goals.', color: [213, 176, 255], assetId: 'facet_aurora_v1', keepsake: { name: 'The Aurora Heart', description: 'Complete all 30 stages.' } },
];

const GEM_NAMES = ['Rubies', 'Ambers', 'Emeralds', 'Sapphires', 'Amethysts', 'Aquamarines'];
const frostPattern = (name, layers = 1) => {
    const cells = [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const r = Math.abs(row - 3.5), c = Math.abs(col - 3.5);
        const on = name === 'window' ? r < 2 && c < 2 : name === 'diamond' ? r + c === 3 :
            name === 'ribbon' ? (row === 3 || row === 4) : name === 'cross' ? (r < 1 && c < 3 || c < 1 && r < 3) :
                name === 'corners' ? (r > 1 && c > 1) : name === 'steps' ? (row >= 2 && row <= 5 && (col === row || col === 7 - row)) :
                    name === 'crown' ? (row === 2 && col > 0 && col < 7 || row === 3 && col % 2 === 0 || row === 4 && col > 1 && col < 6) :
                        name === 'ring' ? (r < 3 && c < 3 && (r > 1 || c > 1)) : false;
        if (on) cells.push({ row, col, layers });
    }
    return cells;
};
const score = target => ({ type: 'score', target });
const collect = (color, target) => ({ type: 'collect', color, target });
const specials = target => ({ type: 'specials', target });

// Fixed seeds make every stage a learnable puzzle. Refills remain genuine
// cascades; retries never pay for a better board or silently change the odds.
const specs = [
    ['First Light', 14, [score(1800)], null, 4000, 'Swap neighboring gems to match three or more. Cascades increase the score multiplier.'],
    ['Ruby Waltz', 18, [collect(0, 14)], null, 6500, 'Four in a line makes a Ray. Match it again to sweep a whole row or column.'],
    ['The Long Cut', 20, [specials(2)], null, 8500, 'Look for matches of four. The gem you move becomes the special gem.'],
    ['Honey & Glass', 20, [collect(1, 16), collect(5, 16)], null, 9500, 'L and T shapes create a Nova. Five in a line makes a color-clearing Prism.'],
    ['A Fine Spark', 20, [score(7500)], null, 11000, 'Swap two special gems to combine their effects, even without a color match.'],
    ['Frosted Window', 24, [], 'window', 11000, 'Match gems on frosted tiles to break the frost. Rays and Novas break it too.'],
    ['Velvet Blue', 22, [collect(3, 22), score(6000)], null, 12500, 'Your Radiance meter fills as you play. When full, three moves score double.'],
    ['Diamond Stitch', 26, [collect(4, 18)], 'diamond', 13000, 'A cascade can crack frost more than once. Look for matches above other pairs.'],
    ['Light in Lines', 24, [specials(3), score(7000)], null, 14000, 'A Ray plus a Nova clears three rows and three columns.'],
    ['The Sunstone', 28, [collect(1, 24), score(9500)], 'steps', 15500, 'Complete this stage to unlock the Verdant Grotto.'],
    ['Below the Surface', 24, [collect(2, 18)], 'ribbon', 13000, 'Frost stays on its tile when gems move. Aim your special gems through it.'],
    ['Emerald Echo', 24, [collect(2, 26), collect(5, 20)], null, 14500, 'A Prism plus any gem clears that color from the whole board.'],
    ['Crystal Stair', 26, [score(10000)], 'steps', 15000, 'Swap neighboring special gems to combine their effects.'],
    ['Deepwater Blue', 26, [collect(3, 24), collect(5, 24)], null, 15500, 'Only successful swaps spend a move. Journey has no time limit.'],
    ['Greenhouse Glass', 30, [collect(2, 18)], 'window:2', 16500, 'Double frost needs two clear waves to remove both layers.'],
    ['A Lovely Collision', 26, [specials(3), score(10500)], null, 16000, 'Two Novas make a much bigger blast. Two Prisms clear the entire board.'],
    ['Petals in the Dark', 30, [collect(4, 22)], 'cross', 17000, 'A Prism plus a Ray or Nova turns matching colors into specials and activates them.'],
    ['Glacial Ribbon', 30, [score(12500)], 'ribbon:2', 18500, 'Matches and special effects clear frost under the affected gems.'],
    ['The Hidden Spring', 28, [collect(2, 28), collect(0, 22)], null, 17500, 'Radiance doubles scoring for three successful moves, including their cascades.'],
    ['Emerald Bloom', 32, [collect(2, 25), score(13500)], 'ring', 20000, 'Complete this stage to unlock the Aurora Spire.'],
    ['Above the Clouds', 26, [collect(4, 26), score(11000)], null, 17500, 'Complete every displayed goal before running out of moves.'],
    ['Rose Quartz', 30, [collect(0, 26)], 'diamond:2', 18500, 'Move a gem into the center of a T or L to forge a Nova where you need it.'],
    ['The Silver Cut', 28, [specials(4), score(12000)], null, 19500, 'An extra moment spent finding a match of four can save several moves later.'],
    ['Northern Lights', 28, [collect(3, 26), collect(4, 26)], null, 20000, 'Collect both listed colors to complete this stage.'],
    ['Frozen Constellation', 32, [collect(5, 24)], 'cross:2', 21000, 'Trace a path through the frost with Rays. Burst through the center with a Nova.'],
    ['A Thousand Glints', 28, [score(17500)], null, 23000, 'Fill Radiance to double scoring on the next three successful moves.'],
    ['The Crownmaker', 32, [collect(1, 24), collect(4, 24)], 'crown', 22000, 'Collect the listed colors and clear every layer of frost.'],
    ['Midnight Garden', 32, [score(16000)], 'ring:2', 23500, 'Clear both frost layers and reach the score goal.'],
    ['Almost Starlight', 30, [collect(0, 28), collect(3, 28), specials(3)], null, 23500, 'Complete all three goals before running out of moves.'],
    ['The Aurora Heart', 34, [collect(4, 28), score(18000)], 'crown:2', 26000, 'Complete the final stage to earn the Aurora Heart.'],
];
const LEVELS = specs.map(([name, moves, goals, pattern, parScore, tip], index) => {
    const [shape, depth] = (pattern || '').split(':');
    const frost = frostPattern(shape, Number(depth) || 1);
    return { id: 'facet-' + (index + 1), index, realmIndex: Math.floor(index / 10), name, moves, goals: frost.length ? [...goals, { type: 'frost', target: frost.reduce((sum, cell) => sum + cell.layers, 0) }] : goals,
        frost, parScore, seed: 14021 + index * 7919, colors: 6, tip, finale: index % 10 === 9 };
});

const ACHIEVEMENTS = [
    { id: 'first-cut', title: 'First Cut', description: 'Complete your first stage.', metric: 'completedLevels', target: 1 },
    { id: 'chain-reaction', title: 'Chain Reaction', description: 'Reach a cascade of five.', metric: 'bestCascade', target: 5 },
    { id: 'gem-cutter', title: 'Gem Cutter', description: 'Create 25 special gems.', metric: 'specials', target: 25 },
    { id: 'duet', title: 'A Brilliant Duet', description: 'Combine 10 pairs of special gems.', metric: 'combos', target: 10 },
    { id: 'radiant', title: 'Inner Light', description: 'Activate Radiance 10 times.', metric: 'radiances', target: 10 },
    { id: 'sunstone', title: 'Keeper of the Sunstone', description: 'Complete the Luminous Atelier.', metric: 'realm0', target: 1 },
    { id: 'emerald', title: 'A Hidden Garden', description: 'Complete the Verdant Grotto.', metric: 'realm1', target: 1 },
    { id: 'aurora', title: 'Light the Sky', description: 'Complete all 30 stages.', metric: 'completedLevels', target: 30 },
    { id: 'treasury', title: 'The Treasury', description: 'Collect 5,000 gems.', metric: 'gems', target: 5000 },
    { id: 'rush', title: 'Quick Silver', description: 'Score 30,000 in a single Rush.', metric: 'rushBest', target: 30000 },
    { id: 'starlight', title: 'A Little More Shine', description: 'Earn 45 Journey stars.', metric: 'totalStars', target: 45 },
    { id: 'masterwork', title: 'The Masterwork', description: 'Earn all 90 Journey stars.', metric: 'totalStars', target: 90 },
];

module.exports = { LEVELS, REALMS, GEM_NAMES, ACHIEVEMENTS, frostPattern };
