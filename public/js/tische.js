// Abgestufte Tische für alle Spiele. Buy-in = Mindestguthaben, um Platz zu nehmen.
// Chips, die an einem Tisch gesetzt werden, kommen immer aus dem gemeinsamen Konto.
export const TISCHE = [
  { id: 0, name: 'Einsteiger',  min: 1,    max: 50,     buyin: 25,     filz: '#0f6b43', rand: '#6fe0a8' },
  { id: 1, name: 'Klassik',     min: 10,   max: 500,    buyin: 250,    filz: '#0d5a73', rand: '#6cc8e8' },
  { id: 2, name: 'Salon',       min: 50,   max: 2500,   buyin: 1000,   filz: '#7a1f33', rand: '#f09ab0' },
  { id: 3, name: 'High Roller', min: 250,  max: 10000,  buyin: 5000,   filz: '#1d2b3a', rand: '#e8c56a' },
  { id: 4, name: 'VIP',         min: 1000, max: 50000,  buyin: 25000,  filz: '#4a2275', rand: '#c9a0f5' },
  { id: 5, name: 'Magnat',      min: 5000, max: 250000, buyin: 100000, filz: '#2b2412', rand: '#ffd45e' },
];
export const tisch = (i) => TISCHE[i] || TISCHE[0];
