class ExpiringSet {
    constructor() {
        this.cache = {};
    }

    put(value, ttl) {
        if (ttl === null || ttl === undefined || Number(ttl) < 1) {
            throw new Error('put() requires a TTL');
        }

        this.cache[value] = setTimeout(() => {
            delete this.cache[value];
        }, ttl);
    }

    has(value) {
        return value in this.cache;
    }

    remove(value) {
        if (this.cache[value]) {
            clearTimeout(this.cache[value]);
            delete this.cache[value];
        }
    }
}

module.exports = { ExpiringSet };
