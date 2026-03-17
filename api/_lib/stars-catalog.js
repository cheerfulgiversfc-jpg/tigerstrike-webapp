const STARS_OFFERS = Object.freeze({
  funds_small: Object.freeze({
    sku: "funds_small",
    name: "Supply Cache",
    stars: 100,
    funds: 12000,
    desc: "Entry pack: best low-cost top-up.",
  }),
  funds_medium: Object.freeze({
    sku: "funds_medium",
    name: "Field Treasury",
    stars: 250,
    funds: 35000,
    desc: "Mid pack with better value per Star.",
  }),
  funds_large: Object.freeze({
    sku: "funds_large",
    name: "War Chest",
    stars: 500,
    funds: 80000,
    desc: "Best value pack for major progression.",
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
