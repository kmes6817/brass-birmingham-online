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
// 位置 0-99（共 100 格），開局位置 10（收入 £0）
//  0~10:  每1格升降1收入  (11格, 收入 -10 ~ 0)
// 11~30:  每2格升降1收入  (20格, 收入 1 ~ 10)
// 31~60:  每3格升降1收入  (30格, 收入 11 ~ 20)
// 61~96:  每4格升降1收入  (36格, 收入 21 ~ 29)
// 97~99:  收入30           (3格)
// ==============================
const INCOME_TRACK = [];
// -10 to 0: 每級1格 (位置 0-10)
for (let i = -10; i <= 0; i++) INCOME_TRACK.push(i);
// 1 to 10: 每級2格 (位置 11-30)
for (let i = 1; i <= 10; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); }
// 11 to 20: 每級3格 (位置 31-60)
for (let i = 11; i <= 20; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); }
// 21 to 29: 每級4格 (位置 61-96)
for (let i = 21; i <= 29; i++) { INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); INCOME_TRACK.push(i); }
// 30: 3格 (位置 97-99)
INCOME_TRACK.push(30); INCOME_TRACK.push(30); INCOME_TRACK.push(30);

// 起始位置 = 格10 = 收入 £0
const STARTING_TRACK_POS = 10;
const MIN_INCOME_LEVEL = -10;

// 工具函數：從軌道位置取得收入金額
function getIncomeLevel(pos) {
  const clamped = Math.max(0, Math.min(pos, INCOME_TRACK.length - 1));
  return INCOME_TRACK[clamped];
}

// 工具函數：借貸降低收入 3（不是等級 3）
// 例：收入 £20 → £17，移到 £17 的最高格
// 收入低於 -10 時 clamp 到位置 0（收入 -10）
function loanDecreasePosition(currentPos) {
  const currentIncome = getIncomeLevel(currentPos);
  const targetIncome = currentIncome - 3;

  if (targetIncome <= MIN_INCOME_LEVEL) {
    return 0; // clamp 到位置 0（收入 -10），不拒絕貸款
  }

  // 找到 targetIncome 的最高格（最後一個值等於 targetIncome 的位置）
  let highestPos = 0;
  for (let p = INCOME_TRACK.length - 1; p >= 0; p--) {
    if (INCOME_TRACK[p] === targetIncome) { highestPos = p; break; }
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
