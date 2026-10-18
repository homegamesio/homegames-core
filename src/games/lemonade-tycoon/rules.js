// Shared, deterministic rules for the shop and swept projectile collisions.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function forecastRecipe(weather) {
    return { sugar: clamp(3 + weather.sweet, 1, 5), lemons: clamp(3 + weather.tart, 1, 5) };
}

function willingness(taste, rep, mods, weather, rush = false) {
    return 1 + taste * 2.5 + rep / 100 * 1.5 + mods.priceTolerance + weather.priceShift + (rush ? 0.65 : 0);
}

function segmentDistance(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

module.exports = { forecastRecipe, willingness, segmentDistance };
