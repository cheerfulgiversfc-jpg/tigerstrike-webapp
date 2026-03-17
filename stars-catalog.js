const STARS_OFFERS = Object.freeze({
  funds_100: Object.freeze({
    sku: "funds_100",
    name: "Supply Cache",
    stars: 100,
    funds: 1000,
    desc: "100 Stars -> $1,000 in-game cash.",
  }),
  funds_250: Object.freeze({
    sku: "funds_250",
    name: "Field Treasury",
    stars: 250,
    funds: 2500,
    desc: "250 Stars -> $2,500 in-game cash.",
  }),
  funds_500: Object.freeze({
    sku: "funds_500",
    name: "War Chest",
    stars: 500,
    funds: 5000,
    desc: "500 Stars -> $5,000 in-game cash.",
  }),
  funds_1000: Object.freeze({
    sku: "funds_1000",
    name: "Command Reserve",
    stars: 1000,
    funds: 10000,
    desc: "1,000 Stars -> $10,000 in-game cash.",
  }),
  funds_2500: Object.freeze({
    sku: "funds_2500",
    name: "Strategic Reserve",
    stars: 2500,
    funds: 25000,
    desc: "2,500 Stars -> $25,000 in-game cash.",
  }),
  funds_5000: Object.freeze({
    sku: "funds_5000",
    name: "High Command Vault",
    stars: 5000,
    funds: 50000,
    desc: "5,000 Stars -> $50,000 in-game cash.",
  }),
  funds_10000: Object.freeze({
    sku: "funds_10000",
    name: "Sovereign Treasury",
    stars: 10000,
    funds: 100000,
    desc: "10,000 Stars -> $100,000 in-game cash.",
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
