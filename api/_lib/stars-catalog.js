const STARS_OFFERS = Object.freeze({
  funds_100: Object.freeze({
    sku: "funds_100",
    kind: "cash",
    name: "Supply Cache",
    stars: 100,
    funds: 1000,
    desc: "Convert 100 Stars into $1,000 in-game cash.",
    grant: Object.freeze({ funds: 1000 }),
  }),
  funds_250: Object.freeze({
    sku: "funds_250",
    kind: "cash",
    name: "Field Treasury",
    stars: 250,
    funds: 2500,
    desc: "Convert 250 Stars into $2,500 in-game cash.",
    grant: Object.freeze({ funds: 2500 }),
  }),
  funds_500: Object.freeze({
    sku: "funds_500",
    kind: "cash",
    name: "War Chest",
    stars: 500,
    funds: 5000,
    desc: "Convert 500 Stars into $5,000 in-game cash.",
    grant: Object.freeze({ funds: 5000 }),
  }),
  funds_1000: Object.freeze({
    sku: "funds_1000",
    kind: "cash",
    name: "Command Reserve",
    stars: 1000,
    funds: 10000,
    desc: "Convert 1,000 Stars into $10,000 in-game cash.",
    grant: Object.freeze({ funds: 10000 }),
  }),
  funds_2500: Object.freeze({
    sku: "funds_2500",
    kind: "cash",
    name: "Strategic Reserve",
    stars: 2500,
    funds: 25000,
    desc: "Convert 2,500 Stars into $25,000 in-game cash.",
    grant: Object.freeze({ funds: 25000 }),
  }),
  funds_5000: Object.freeze({
    sku: "funds_5000",
    kind: "cash",
    name: "High Command Vault",
    stars: 5000,
    funds: 50000,
    desc: "Convert 5,000 Stars into $50,000 in-game cash.",
    grant: Object.freeze({ funds: 50000 }),
  }),
  funds_10000: Object.freeze({
    sku: "funds_10000",
    kind: "cash",
    name: "Sovereign Treasury",
    stars: 10000,
    funds: 100000,
    desc: "Convert 10,000 Stars into $100,000 in-game cash.",
    grant: Object.freeze({ funds: 100000 }),
  }),
  premium_supply_drop: Object.freeze({
    sku: "premium_supply_drop",
    kind: "bundle",
    name: "Supply Drop",
    stars: 100,
    desc: "Instant refill pack for active runs.",
    grant: Object.freeze({
      medkits: Object.freeze({ M_SMALL: 3, M_MED: 2 }),
      repairs: Object.freeze({ T_REPAIR: 2 }),
      traps: 3,
      shields: 1,
    }),
  }),
  premium_arsenal_convoy: Object.freeze({
    sku: "premium_arsenal_convoy",
    kind: "bundle",
    name: "Arsenal Convoy",
    stars: 250,
    desc: "Large ammo shipment and maintenance support.",
    grant: Object.freeze({
      ammo: Object.freeze({ "9MM_STD": 120, "556_STD": 60, "762_STD": 40, "TRANQ_DARTS": 40 }),
      repairs: Object.freeze({ T_REPAIR_PRO: 1 }),
      traps: 2,
    }),
  }),
  premium_rescue_priority: Object.freeze({
    sku: "premium_rescue_priority",
    kind: "bundle",
    name: "Rescue Priority",
    stars: 500,
    desc: "High-pressure mission support for survival streaks.",
    grant: Object.freeze({
      shields: 5,
      traps: 8,
      medkits: Object.freeze({ M_TRAUMA: 3 }),
      repairs: Object.freeze({ T_REPAIR_PRO: 2 }),
    }),
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
