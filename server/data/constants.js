// 遊戲常數 - Brass: Birmingham（最終版 - 含變速收入軌）

const ERAS = { CANAL: 'canal', RAIL: 'rail' };

const INDUSTRY_TYPES = {
  COTTON: 'cotton',
  COAL: 'coal',
  IRON: 'iron',
  MANUFACTURER: 'manufacturer',
  POTTERY: 'pottery',
  BREWERY: 'brewery'
};

// ==============================
// 收入軌道（變速間距）
// 等級越高，每級佔越多格 → 越難爬
// -10~0: 每級1格 (11格)
//  1~10: 每級2格 (20格)
// 11~20: 每級3格 (30格)
// 21~30: 每級4格 (40格)
// 共 101 格（位置 0-100）
// ==============================
const INCOME_TRACK = [];
// -10 to 0: 每級1格
for (let i = -10; i <= 0; i++) INCOME_TRACK.push(i);
// 1 to 10: 每級2格
for (let i = 1; i <= 10; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); }
// 11 to 20: 每級3格
for (let i = 11; i <= 20; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); }
// 21 to 30: 每級4格
for (let i = 21; i <= 30; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); }

// 起始位置 = 格10 = 收入等級 0 = 每回合收 £0
const STARTING_TRACK_POS = 10;
const MIN_INCOME_LEVEL = -10;

// 工具函數：從軌道位置取得收入等級
function getIncomeLevel(pos) {
  const clamped = Math.max(0, Math.min(pos, INCOME_TRACK.length - 1));
  return INCOME_TRACK[clamped];
}

// 工具函數：借貸後退3等級，停在新等級的最高格
function loanDecreasePosition(currentPos) {
  const currentLevel = getIncomeLevel(currentPos);
  const targetLevel = currentLevel - 3;
  if (targetLevel < MIN_INCOME_LEVEL) return -1; // 不允許借貸

  // 找到 targetLevel 的最高格（最後一個值等於 targetLevel 的位置）
  let highestPos = 0;
  for (let p = INCOME_TRACK.length - 1; p >= 0; p--) {
    if (INCOME_TRACK[p] === targetLevel) { highestPos = p; break; }
  }
  return highestPos;
}

// 煤炭市場
const COAL_MARKET_PRICES = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 8];
const COAL_MARKET_INITIAL = 13;
const COAL_MARKET_SIZE = 14;

// 鐵市場
const IRON_MARKET_PRICES = [1, 1, 2, 2, 3, 3, 4, 5, 6, 6];
const IRON_MARKET_INITIAL = 8;
const IRON_MARKET_SIZE = 10;

const STARTING_MONEY = { 2: 17, 3: 17, 4: 17 };
const HAND_SIZE = 8;
const ACTIONS_PER_TURN = 2;
const LOAN_AMOUNT = 30;

const CANAL_LINK_COST = 3;
const RAIL_LINK_COST = 5;

module.exports = {
  ERAS,
  INDUSTRY_TYPES,
  INCOME_TRACK,
  STARTING_TRACK_POS,
  MIN_INCOME_LEVEL,
  getIncomeLevel,
  loanDecreasePosition,
  COAL_MARKET_PRICES,
  COAL_MARKET_INITIAL,
  COAL_MARKET_SIZE,
  IRON_MARKET_PRICES,
  IRON_MARKET_INITIAL,
  IRON_MARKET_SIZE,
  STARTING_MONEY,
  HAND_SIZE,
  ACTIONS_PER_TURN,
  LOAN_AMOUNT,
  CANAL_LINK_COST,
  RAIL_LINK_COST
};
