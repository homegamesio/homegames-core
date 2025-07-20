class ResourceManager {
    constructor() {
        // Player starts with 100 sugar and $50
        this.sugar = 100;
        this.lemons = 0;
        this.money = 50;
        
        // Track resources at start of combat round (for death penalty)
        this.sugarAtRoundStart = 100;
        this.lemonsAtRoundStart = 0;
        
        // Track resources gained this round
        this.sugarGainedThisRound = 0;
        this.lemonsGainedThisRound = 0;
    }
    
    // Combat round management
    startCombatRound() {
        // Save current resources as starting point
        this.sugarAtRoundStart = this.sugar;
        this.lemonsAtRoundStart = this.lemons;
        
        // Reset round tracking
        this.sugarGainedThisRound = 0;
        this.lemonsGainedThisRound = 0;
        
        console.log(`Combat round started with ${this.sugar} sugar, ${this.lemons} lemons`);
    }
    
    // Resource gathering
    addSugar(amount) {
        this.sugar += amount;
        this.sugarGainedThisRound += amount;
        console.log(`Gained ${amount} sugar! Total: ${this.sugar} (+${this.sugarGainedThisRound} this round)`);
    }
    
    addLemons(amount) {
        this.lemons += amount;
        this.lemonsGainedThisRound += amount;
        console.log(`Gained ${amount} lemons! Total: ${this.lemons} (+${this.lemonsGainedThisRound} this round)`);
    }
    
    // Death penalty - lose all resources gained this round
    handlePlayerDeath() {
        const sugarLost = this.sugarGainedThisRound;
        const lemonsLost = this.lemonsGainedThisRound;
        
        // Revert to round start amounts
        this.sugar = this.sugarAtRoundStart;
        this.lemons = this.lemonsAtRoundStart;
        
        console.log(`Player died! Lost ${sugarLost} sugar and ${lemonsLost} lemons from this round.`);
        console.log(`Resources reverted to: ${this.sugar} sugar, ${this.lemons} lemons`);
        
        return { sugarLost, lemonsLost };
    }
    
    // Lemonade crafting
    canMakeLemonade(sugarPerServing, lemonsPerServing, servingsNeeded = 1) {
        const totalSugarNeeded = sugarPerServing * servingsNeeded;
        const totalLemonsNeeded = lemonsPerServing * servingsNeeded;
        
        return this.sugar >= totalSugarNeeded && this.lemons >= totalLemonsNeeded;
    }
    
    getMaxServings(sugarPerServing, lemonsPerServing) {
        if (sugarPerServing === 0 && lemonsPerServing === 0) return 0;
        
        const maxFromSugar = sugarPerServing > 0 ? Math.floor(this.sugar / sugarPerServing) : Infinity;
        const maxFromLemons = lemonsPerServing > 0 ? Math.floor(this.lemons / lemonsPerServing) : Infinity;
        
        return Math.min(maxFromSugar, maxFromLemons);
    }
    
    consumeResourcesForLemonade(sugarPerServing, lemonsPerServing, servingsNeeded) {
        const totalSugarNeeded = sugarPerServing * servingsNeeded;
        const totalLemonsNeeded = lemonsPerServing * servingsNeeded;
        
        if (!this.canMakeLemonade(sugarPerServing, lemonsPerServing, servingsNeeded)) {
            return false;
        }
        
        this.sugar -= totalSugarNeeded;
        this.lemons -= totalLemonsNeeded;
        
        console.log(`Made ${servingsNeeded} servings using ${totalSugarNeeded} sugar and ${totalLemonsNeeded} lemons`);
        console.log(`Remaining: ${this.sugar} sugar, ${this.lemons} lemons`);
        
        return true;
    }
    
    // Money management
    addMoney(amount) {
        this.money += amount;
        console.log(`Earned $${amount.toFixed(2)}! Total: $${this.money.toFixed(2)}`);
    }
    
    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            console.log(`Spent $${amount.toFixed(2)}. Remaining: $${this.money.toFixed(2)}`);
            return true;
        }
        return false;
    }
    
    canAfford(amount) {
        return this.money >= amount;
    }
    
    // Getters
    getSugar() {
        return this.sugar;
    }
    
    getLemons() {
        return this.lemons;
    }
    
    getMoney() {
        return this.money;
    }
    
    getSugarGainedThisRound() {
        return this.sugarGainedThisRound;
    }
    
    getLemonsGainedThisRound() {
        return this.lemonsGainedThisRound;
    }
    
    // Resource display
    getResourceSummary() {
        return {
            sugar: this.sugar,
            lemons: this.lemons,
            money: this.money,
            sugarGained: this.sugarGainedThisRound,
            lemonsGained: this.lemonsGainedThisRound
        };
    }
    
    // Reset for new game
    reset() {
        this.sugar = 100;
        this.lemons = 0;
        this.money = 50;
        this.sugarAtRoundStart = 100;
        this.lemonsAtRoundStart = 0;
        this.sugarGainedThisRound = 0;
        this.lemonsGainedThisRound = 0;
        console.log('Resources reset to starting values');
    }
}

module.exports = ResourceManager; 