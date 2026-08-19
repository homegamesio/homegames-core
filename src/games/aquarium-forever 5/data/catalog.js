module.exports = {
    tanks: [
        {
            id: 'starter',
            name: 'STARTER TANK',
            width: 100,
            fishCap: 72,
            decorScale: 1,
            rewardScale: 1,
            storeScale: 1,
            upgradeCost: 0
        },
        {
            id: 'wide',
            name: 'WIDE TANK',
            width: 190,
            fishCap: 112,
            decorScale: 2,
            rewardScale: 10,
            storeScale: 12,
            upgradeCost: 50000
        },
        {
            id: 'gallery',
            name: 'GALLERY TANK',
            width: 340,
            fishCap: 160,
            decorScale: 3,
            rewardScale: 120,
            storeScale: 150,
            upgradeCost: 8000000
        },
        {
            id: 'ocean-wall',
            name: 'OCEAN WALL',
            width: 560,
            fishCap: 224,
            decorScale: 5,
            rewardScale: 1500,
            storeScale: 2000,
            upgradeCost: 1500000000
        }
    ],
    fish: [
        {
            id: 'guppy',
            name: 'GUPPY',
            baseCost: 25,
            reward: 1,
            speed: 8.4,
            length: 3.0,
            height: 1.45,
            colors: [[255, 173, 73, 255], [255, 231, 137, 255], [35, 39, 54, 255]]
        },
        {
            id: 'clown',
            name: 'CLOWNFISH',
            baseCost: 100,
            reward: 3,
            speed: 7.5,
            length: 4.1,
            height: 2.0,
            colors: [[245, 127, 45, 255], [246, 246, 240, 255], [34, 34, 43, 255]]
        },
        {
            id: 'tang',
            name: 'BLUE TANG',
            baseCost: 450,
            reward: 8,
            speed: 10.4,
            length: 4.7,
            height: 2.45,
            colors: [[57, 106, 224, 255], [255, 214, 70, 255], [20, 29, 50, 255]]
        },
        {
            id: 'angel',
            name: 'ANGELFISH',
            baseCost: 2000,
            reward: 22,
            speed: 6.2,
            length: 3.7,
            height: 3.45,
            colors: [[245, 208, 89, 255], [31, 31, 43, 255], [116, 209, 241, 255]]
        },
        {
            id: 'puffer',
            name: 'PUFFER',
            baseCost: 9000,
            reward: 65,
            speed: 4.8,
            length: 3.4,
            height: 3.2,
            colors: [[224, 196, 112, 255], [246, 239, 214, 255], [40, 40, 45, 255]]
        }
    ],
    decor: [
        {
            id: 'plant',
            name: 'SEAWEED',
            baseCost: 75,
            max: 10,
            description: '+2% ALL FOOD'
        },
        {
            id: 'coral',
            name: 'CORAL',
            baseCost: 350,
            max: 8,
            description: '+5% ALL FOOD'
        },
        {
            id: 'bubbler',
            name: 'BUBBLER',
            baseCost: 1800,
            max: 8,
            description: 'AUTO FEEDS'
        },
        {
            id: 'castle',
            name: 'CASTLE',
            baseCost: 8000,
            max: 5,
            description: '+15% YOUR FOOD'
        },
        {
            id: 'flakes',
            name: 'BETTER FLAKES',
            baseCost: 250,
            max: 999,
            description: '+1 FOOD VALUE'
        }
    ]
};


