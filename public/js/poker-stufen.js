// Blinds und Buy-ins der Pokertische (Client und Server benutzen dieselbe Liste). Buy-in: 20 bis 100 große Blinds.
export const STUFEN = [
  { name: 'Einsteiger',  sb: 1,    bb: 2,    minBuy: 40,     maxBuy: 200 },
  { name: 'Klassik',     sb: 5,    bb: 10,   minBuy: 200,    maxBuy: 1000 },
  { name: 'Salon',       sb: 25,   bb: 50,   minBuy: 1000,   maxBuy: 5000 },
  { name: 'High Roller', sb: 100,  bb: 200,  minBuy: 4000,   maxBuy: 20000 },
  { name: 'VIP',         sb: 500,  bb: 1000, minBuy: 20000,  maxBuy: 100000 },
  { name: 'Magnat',      sb: 2500, bb: 5000, minBuy: 100000, maxBuy: 500000 },
];
