const STARS_OFFERS = Object.freeze({
  funds_small: Object.freeze({
    sku: "funds_small",
    name: "Supply Cache",
    stars: 15,
    funds: 1800,
    desc: "Fast refill for ammo and meds.",
  }),
  funds_medium: Object.freeze({
    sku: "funds_medium",
    name: "Field Treasury",
    stars: 45,
    funds: 6200,
    desc: "Solid mission run boost.",
  }),
  funds_large: Object.freeze({
    sku: "funds_large",
    name: "War Chest",
    stars: 120,
    funds: 18500,
    desc: "Big push for squad and meta upgrades.",
  }),
});

function getOffer(sku){
  if(!sku || typeof sku !== "string") return null;
  return STARS_OFFERS[sku] || null;
}

module.exports = {
  STARS_OFFERS,
  getOffer,
};
