// Shared presentation and gameplay settings. Keep metadata in index.js literal
// so Homegames can discover the game without executing it.
const TUNING = { tickRate:20, goal:12, flightSeconds:2.2, hitFrom:.81, hitUntil:1.065, meshBudget:800 };
const BRAND = { title:'SUNSIDE', subtitle:'THE CHARACTER STUDIO', character:'Mika.', biography:'25 / VOLLEYBALL CAPTAIN' };
const COLORS = {
    ink:[32,66,78,255], muted:[93,123,124,255], cream:[255,249,231,255],
    paper:[250,240,216,255], sea:[47,121,139,255], coral:[223,112,91,255], gold:[242,186,92,255],
    line:[199,215,204,255], white:[255,254,246,255], mint:[126,190,171,255],
};
const SWATCHES = [COLORS.coral,[52,125,156,255],[102,143,116,255]];
const CAMERA = {
    minZoom:1, maxZoom:2.05, orbitSpeed:.18,
    presets:{full:{zoom:1,yaw:-.10},threequarter:{zoom:1.08,yaw:-.62},portrait:{zoom:2.05,yaw:-.10}},
};
const CHARACTER_COLORS = {
    skin:[238,183,151,255], skinLight:[249,206,174,255],
    hair:[48,45,64,255], hairLight:[72,66,87,255], hairShine:[99,87,111,255],
    ink:[35,41,53,255], white:[255,247,227,255], iris:[65,143,134,255],
    gold:[247,191,88,255], lips:[175,96,92,255], sole:[219,181,137,255],
};

module.exports = { TUNING, BRAND, COLORS, SWATCHES, CAMERA, CHARACTER_COLORS };
