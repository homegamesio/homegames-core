const { GameNode, ShapeUtils, Shapes } = require('squish-136');

class LemonadeStandSystem {
    constructor(config) {
        // Lemonade stand configuration
        this.config = config;
        
        // Customer management
        this.walkingCustomers = []; // Customers currently walking across screen
        this.stoppedCustomers = []; // Customers who stopped at the stand
        this.lastCustomerSpawn = 0;
        this.customerSpawnInterval = 2000; // Spawn every 2 seconds
        this.standRevenue = 0;
        this.standDay = 1;
        this.addictionLevels = {}; // Track customer addiction
        this.bosses = []; // Track customers who became bosses
        
        // Recipe system
        this.recipe = {
            sugar: 5,
            lemons: 3
        };
        
        // Pricing system
        this.price = 1.50; // Default price
        
        // Define unique customers with distinct traits
        this.uniqueCustomers = [
            { name: 'Sweet Sally', trait: 'sweet_tooth', color: [255, 192, 203, 255], stopChance: 0.8, buyChance: 0.9, preferredPrice: 1.5 },
            { name: 'Sour Sam', trait: 'tart_lover', color: [255, 255, 0, 255], stopChance: 0.6, buyChance: 0.7, preferredPrice: 1.2 },
            { name: 'Balanced Bob', trait: 'balanced', color: [144, 238, 144, 255], stopChance: 0.7, buyChance: 0.8, preferredPrice: 1.0 },
            { name: 'Rich Rita', trait: 'wealthy', color: [255, 215, 0, 255], stopChance: 0.5, buyChance: 0.9, preferredPrice: 3.0 },
            { name: 'Cheap Charlie', trait: 'budget', color: [139, 69, 19, 255], stopChance: 0.9, buyChance: 0.3, preferredPrice: 0.5 },
            { name: 'Picky Pete', trait: 'critic', color: [128, 0, 128, 255], stopChance: 0.4, buyChance: 0.5, preferredPrice: 2.0 },
            { name: 'Loyal Lucy', trait: 'regular', color: [0, 191, 255, 255], stopChance: 0.95, buyChance: 0.85, preferredPrice: 1.3 },
            { name: 'Speedy Steve', trait: 'rushed', color: [255, 69, 0, 255], stopChance: 0.3, buyChance: 0.6, preferredPrice: 1.8 },
            { name: 'Curious Carla', trait: 'explorer', color: [255, 20, 147, 255], stopChance: 0.8, buyChance: 0.4, preferredPrice: 1.1 },
            { name: 'Grumpy Greg', trait: 'pessimist', color: [105, 105, 105, 255], stopChance: 0.6, buyChance: 0.2, preferredPrice: 0.8 }
        ];
        
        // Generic customer traits for filling gaps
        this.genericTraits = [
            { trait: 'casual', color: [176, 196, 222, 255], stopChance: 0.6, buyChance: 0.6, preferredPrice: 1.0 },
            { trait: 'tourist', color: [255, 182, 193, 255], stopChance: 0.7, buyChance: 0.7, preferredPrice: 1.4 },
            { trait: 'local', color: [152, 251, 152, 255], stopChance: 0.8, buyChance: 0.5, preferredPrice: 0.9 },
            { trait: 'student', color: [173, 216, 230, 255], stopChance: 0.5, buyChance: 0.4, preferredPrice: 0.7 }
        ];
        
        this.usedUniqueCustomers = []; // Track which unique customers appeared today
        
        // Stand timer
        this.standStartTime = null;
        this.standDuration = 30000; // 30 seconds of selling
    }
    
    // Recipe management
    updateRecipe(sugar, lemons) {
        this.recipe.sugar = sugar;
        this.recipe.lemons = lemons;
    }
    
    calculateLemonadePrice() {
        // Return the player-set price
        return this.price;
    }
    
    setPrice(newPrice) {
        this.price = Math.max(0.25, Math.min(5.0, newPrice));
        console.log(`Lemonade price set to $${this.price.toFixed(2)}`);
    }
    
    // Customer spawning and management
    spawnWalkingCustomer() {
        // Decide if this should be a unique customer or generic
        const useUniqueCustomer = Math.random() < 0.4 && this.usedUniqueCustomers.length < this.uniqueCustomers.length;
        
        let customerData;
        let customerId;
        
        if (useUniqueCustomer) {
            // Pick a unique customer we haven't used yet
            const availableUnique = this.uniqueCustomers.filter(customer => 
                !this.usedUniqueCustomers.includes(customer.name)
            );
            customerData = availableUnique[Math.floor(Math.random() * availableUnique.length)];
            this.usedUniqueCustomers.push(customerData.name);
            customerId = `${customerData.name}_${this.standDay}`;
        } else {
            // Create a generic customer
            const genericNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Avery', 'Blake', 'Quinn'];
            const name = genericNames[Math.floor(Math.random() * genericNames.length)];
            const traitData = this.genericTraits[Math.floor(Math.random() * this.genericTraits.length)];
            
            customerData = {
                name: name,
                trait: traitData.trait,
                color: traitData.color,
                stopChance: traitData.stopChance,
                buyChance: traitData.buyChance,
                preferredPrice: traitData.preferredPrice
            };
            customerId = `${name}_${this.standDay}_${Date.now()}`;
        }
        
        // Determine spawn side (left or right)
        const spawnFromLeft = Math.random() < 0.5;
        const speed = 0.8 + Math.random() * 0.6; // Random walking speed
        
        const customer = {
            ...customerData,
            id: customerId,
            x: spawnFromLeft ? -10 : 110, // Start off-screen
            y: 45, // Walking level
            targetX: spawnFromLeft ? 110 : -10, // Walk to other side
            speed: speed,
            direction: spawnFromLeft ? 1 : -1,
            spawnTime: Date.now(),
            state: 'walking', // 'walking', 'stopped', 'purchasing', 'leaving'
            addictionLevel: this.addictionLevels[customerId] || 0,
            hasCheckedForStop: false
        };
        
        this.walkingCustomers.push(customer);
        console.log(`${customer.name} (${customer.trait}) starts walking from ${spawnFromLeft ? 'left' : 'right'}`);
    }
    
    updateCustomers(currentTime, resourceManager) {
        let needsViewUpdate = false;
        
        // Spawn new customers periodically
        if (currentTime - this.lastCustomerSpawn >= this.customerSpawnInterval) {
            this.spawnWalkingCustomer();
            this.lastCustomerSpawn = currentTime;
            needsViewUpdate = true;
        }
        
        // Update walking customers
        for (let i = this.walkingCustomers.length - 1; i >= 0; i--) {
            const customer = this.walkingCustomers[i];
            
            if (customer.state === 'walking') {
                // Move customer
                customer.x += customer.direction * customer.speed;
                needsViewUpdate = true; // Customer movement requires view update
                
                // Check if customer reached the stand area (center of screen)
                if (!customer.hasCheckedForStop && 
                    ((customer.direction === 1 && customer.x >= 40) || 
                     (customer.direction === -1 && customer.x <= 60))) {
                    
                    customer.hasCheckedForStop = true;
                    
                    // Check if customer decides to stop
                    if (Math.random() < customer.stopChance) {
                        customer.state = 'stopped';
                        customer.x = 50; // Position at stand
                        customer.stopTime = currentTime;
                        this.stoppedCustomers.push(customer);
                        this.walkingCustomers.splice(i, 1);
                        console.log(`${customer.name} stopped at the stand!`);
                        needsViewUpdate = true;
                        continue;
                    }
                }
                
                // Remove customers who walked off screen
                if (customer.x < -15 || customer.x > 115) {
                    this.walkingCustomers.splice(i, 1);
                    console.log(`${customer.name} walked away without stopping`);
                    needsViewUpdate = true;
                }
            }
        }
        
        // Update stopped customers
        for (let i = this.stoppedCustomers.length - 1; i >= 0; i--) {
            const customer = this.stoppedCustomers[i];
            
            if (customer.state === 'stopped') {
                // Customer has been stopped for 2 seconds, decide whether to buy
                if (currentTime - customer.stopTime >= 2000) {
                    const currentPrice = this.calculateLemonadePrice();
                    const priceModifier = customer.preferredPrice / currentPrice;
                    const adjustedBuyChance = customer.buyChance * Math.min(1.5, priceModifier);
                    
                    if (Math.random() < adjustedBuyChance) {
                        // Customer buys!
                        this.completePurchase(customer, currentPrice, resourceManager);
                        customer.state = 'leaving';
                        customer.leaveTime = currentTime;
                    } else {
                        // Customer decides not to buy
                        console.log(`${customer.name} decided not to buy (price: $${currentPrice.toFixed(2)})`);
                        customer.state = 'leaving';
                        customer.leaveTime = currentTime;
                    }
                    needsViewUpdate = true;
                }
            } else if (customer.state === 'leaving') {
                // Remove customer after showing purchase result for 2 seconds
                if (currentTime - customer.leaveTime >= 2000) {
                    this.stoppedCustomers.splice(i, 1);
                    console.log(`${customer.name} leaves the stand`);
                    needsViewUpdate = true;
                }
            }
        }
        
        return needsViewUpdate;
    }
    
    completePurchase(customer, price, resourceManager) {
        const sugar = this.recipe.sugar;
        const lemons = this.recipe.lemons;
        
        // Check if we have enough resources to make this serving
        if (!resourceManager.canMakeLemonade(sugar, lemons, 1)) {
            console.log(`Not enough resources to make lemonade for ${customer.name}! Need ${sugar} sugar, ${lemons} lemons`);
            customer.state = 'leaving';
            customer.leaveTime = Date.now();
            customer.purchased = false;
            customer.reaction = 'Out of ingredients!';
            return;
        }
        
        // Consume resources to make the lemonade
        resourceManager.consumeResourcesForLemonade(sugar, lemons, 1);
        
        // Calculate satisfaction based on customer trait and recipe
        let satisfaction = this.calculateCustomerSatisfaction(customer, sugar, lemons);
        
        // Adjust price based on satisfaction
        let finalPrice = price;
        let reaction = '';
        
        if (satisfaction >= 80) {
            reaction = 'Loves it!';
            finalPrice *= 1.2; // Willing to pay 20% more
        } else if (satisfaction >= 60) {
            reaction = 'Pretty good!';
        } else if (satisfaction >= 40) {
            reaction = 'It\'s okay...';
            finalPrice *= 0.8; // Pays 20% less
        } else {
            reaction = 'Not great.';
            finalPrice *= 0.5; // Pays half price
        }

        // Update addiction level based on sugar content
        const sugarAddiction = Math.floor(sugar / 3); // Every 3 sugar = 1 addiction point
        this.addictionLevels[customer.id] = (this.addictionLevels[customer.id] || 0) + sugarAddiction;
        
        // Check if customer becomes a boss
        if (this.addictionLevels[customer.id] >= 10 && !this.bosses.includes(customer.id)) {
            this.bosses.push(customer.id);
            console.log(`${customer.name} became a sugar-crazed boss!`);
        }

        this.standRevenue += finalPrice;
        
        // Add money to the resource manager so player can buy upgrades
        resourceManager.addMoney(finalPrice);
        
        customer.satisfaction = satisfaction;
        customer.finalPrice = finalPrice;
        customer.reaction = reaction;
        customer.purchased = true;

        console.log(`${customer.name}: ${reaction} (${satisfaction}% satisfaction, $${finalPrice.toFixed(2)}, addiction: ${this.addictionLevels[customer.id]})`);
    }
    
    calculateCustomerSatisfaction(customer, sugar, lemons) {
        let satisfaction = 0;
        
        switch (customer.trait) {
            case 'sweet_tooth':
                satisfaction = Math.min(100, sugar * 15 + Math.max(0, 50 - lemons * 10));
                break;
            case 'tart_lover':
                satisfaction = Math.min(100, lemons * 20 + Math.max(0, 30 - sugar * 5));
                break;
            case 'balanced':
                satisfaction = Math.min(100, 70 - Math.abs(sugar - lemons) * 10);
                break;
            case 'wealthy':
                satisfaction = Math.min(100, 60 + sugar * 8 + lemons * 8); // Appreciates quality
                break;
            case 'budget':
                satisfaction = Math.min(100, 80 - sugar * 3 - lemons * 3); // Prefers simple/cheap
                break;
            case 'critic':
                satisfaction = Math.min(100, Math.abs(sugar - 5) < 2 && Math.abs(lemons - 3) < 2 ? 90 : 30); // Very picky
                break;
            case 'regular':
                satisfaction = Math.min(100, 60 + Math.min(sugar, 8) * 5 + Math.min(lemons, 5) * 4); // Loyal but reasonable
                break;
            case 'rushed':
                satisfaction = Math.min(100, 50 + Math.random() * 40); // Random, just wants something quick
                break;
            case 'explorer':
                satisfaction = Math.min(100, sugar + lemons > 8 ? 80 : 40); // Likes adventurous recipes
                break;
            case 'pessimist':
                satisfaction = Math.min(100, Math.max(20, 60 - Math.random() * 30)); // Always somewhat dissatisfied
                break;
            default: // Generic traits
                if (customer.trait === 'casual') {
                    satisfaction = Math.min(100, 50 + sugar * 5 + lemons * 5);
                } else if (customer.trait === 'tourist') {
                    satisfaction = Math.min(100, 60 + sugar * 6 + lemons * 6);
                } else if (customer.trait === 'local') {
                    satisfaction = Math.min(100, 70 + sugar * 4 + lemons * 4);
                } else if (customer.trait === 'student') {
                    satisfaction = Math.min(100, 40 + sugar * 8); // Prefers sweet, cheap
                }
                break;
        }
        
        return satisfaction;
    }
    
    getTraitDisplayName(trait) {
        switch (trait) {
            case 'sweet_tooth': return 'Sweet Tooth';
            case 'tart_lover': return 'Tart Lover';
            case 'balanced': return 'Balanced';
            case 'wealthy': return 'Rich';
            case 'budget': return 'Cheap';
            case 'critic': return 'Picky';
            case 'regular': return 'Loyal';
            case 'rushed': return 'Rushed';
            case 'explorer': return 'Curious';
            case 'pessimist': return 'Grumpy';
            case 'casual': return 'Casual';
            case 'tourist': return 'Tourist';
            case 'local': return 'Local';
            case 'student': return 'Student';
            default: return trait;
        }
    }

    // Stand phase management
    startStand() {
        this.standStartTime = Date.now();
        this.walkingCustomers = [];
        this.stoppedCustomers = [];
        this.lastCustomerSpawn = 0;
        this.usedUniqueCustomers = []; // Reset unique customers for new day
        console.log('Started lemonade stand');
    }

    isStandActive() {
        return this.standStartTime !== null;
    }

    getTimeRemaining() {
        if (!this.standStartTime) return 0;
        const elapsed = Date.now() - this.standStartTime;
        return Math.max(0, this.standDuration - elapsed);
    }

    isStandTimeUp() {
        return this.getTimeRemaining() <= 0;
    }

    advanceDay() {
        this.standDay++;
        
        // Lemons go bad after each day (reset to 0)
        this.recipe.lemons = 0;
        
        // Reset stand data for new day
        this.standRevenue = 0;
        this.walkingCustomers = [];
        this.stoppedCustomers = [];
        this.usedUniqueCustomers = [];
        this.standStartTime = null;
        
        console.log(`Advanced to Day ${this.standDay}. Lemons went bad! New bosses: ${this.bosses.length}`);
    }

    // View creation helpers
    addWalkingCustomerToView(viewRoot, customer, playerId) {
        // Customer figure walking on sidewalk
        const customerShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(customer.x - 2, customer.y - 3, 4, 6),
            fill: customer.color,
            // playerIds: [playerId]
        });

        // Customer name above head
        const nameText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: customer.y - 5,
                color: [0, 0, 0, 255],
                text: customer.name,
                align: 'center',
                size: 0.8
            },
            // playerIds: [playerId]
        });

        // Trait indicator (small text)
        const traitText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: customer.y + 4,
                color: [100, 100, 100, 255],
                text: this.getTraitDisplayName(customer.trait),
                align: 'center',
                size: 0.6
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(customerShape);
        viewRoot.addChild(nameText);
        viewRoot.addChild(traitText);
    }

    addStoppedCustomerToView(viewRoot, customer, playerId) {
        // Customer figure at the stand
        const customerShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(customer.x - 3, 50, 6, 8),
            fill: customer.color,
            // playerIds: [playerId]
        });

        // Customer name
        const nameText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: 48,
                color: [0, 0, 0, 255],
                text: customer.name,
                align: 'center',
                size: 1.0
            },
            // playerIds: [playerId]
        });

        // Customer trait
        const traitText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: 60,
                color: [100, 100, 100, 255],
                text: this.getTraitDisplayName(customer.trait),
                align: 'center',
                size: 0.8
            },
            // playerIds: [playerId]
        });

        // Show purchase result if customer bought something
        if (customer.purchased) {
            const reactionText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: customer.satisfaction >= 60 ? [0, 150, 0, 255] : [150, 0, 0, 255],
                    text: customer.reaction,
                    align: 'center',
                    size: 1.0
                },
                // playerIds: [playerId]
            });

            const priceText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 70,
                    color: [0, 100, 0, 255],
                    text: `$${customer.finalPrice.toFixed(2)}`,
                    align: 'center',
                    size: 0.8
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(reactionText);
            viewRoot.addChild(priceText);
        } else if (customer.state === 'leaving' && !customer.purchased) {
            // Customer decided not to buy
            const noSaleText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: [150, 0, 0, 255],
                    text: 'Not buying',
                    align: 'center',
                    size: 0.9
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(noSaleText);
        } else {
            // Customer is deciding
            const thinkingText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: [100, 100, 100, 255],
                    text: '...',
                    align: 'center',
                    size: 1.2
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(thinkingText);
        }

        viewRoot.addChild(customerShape);
        viewRoot.addChild(nameText);
        viewRoot.addChild(traitText);
    }

    // Getters for main game
    hasMovingCustomers() {
        return this.walkingCustomers.length > 0;
    }

    getBossCount() {
        return this.bosses.length;
    }

    getAddictionStats() {
        return Object.keys(this.addictionLevels).length;
    }

    // Reset method
    reset() {
        this.walkingCustomers = [];
        this.stoppedCustomers = [];
        this.lastCustomerSpawn = 0;
        this.standRevenue = 0;
        this.standStartTime = null;
        this.usedUniqueCustomers = [];
    }
}

module.exports = LemonadeStandSystem; 