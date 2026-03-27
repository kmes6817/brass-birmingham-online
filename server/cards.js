// Card deck for Brass: Birmingham
// 官方牌數：4人=64, 3人=54, 2人=40
// 每張標記最低玩家數 (minPlayers)

const { locations } = require('./data/board');
const { INDUSTRY_TYPES: T } = require('./data/constants');

// 所有牌定義（含最低玩家數標記）
// minPlayers: 2=所有遊戲都用, 3=3人以上, 4=4人限定
const allCards = [
  // === 地點牌 (36張 for 4人) ===
  { type:'location', location:'birmingham', minPlayers:2 },
  { type:'location', location:'birmingham', minPlayers:2 },
  { type:'location', location:'birmingham', minPlayers:2 },
  { type:'location', location:'coventry', minPlayers:2 },
  { type:'location', location:'coventry', minPlayers:2 },
  { type:'location', location:'coventry', minPlayers:4 },
  { type:'location', location:'dudley', minPlayers:2 },
  { type:'location', location:'dudley', minPlayers:3 },
  { type:'location', location:'wolverhampton', minPlayers:2 },
  { type:'location', location:'wolverhampton', minPlayers:3 },
  { type:'location', location:'coalbrookdale', minPlayers:2 },
  { type:'location', location:'coalbrookdale', minPlayers:2 },
  { type:'location', location:'coalbrookdale', minPlayers:4 },
  { type:'location', location:'kidderminster', minPlayers:2 },
  { type:'location', location:'kidderminster', minPlayers:3 },
  { type:'location', location:'worcester', minPlayers:2 },
  { type:'location', location:'worcester', minPlayers:2 },
  { type:'location', location:'walsall', minPlayers:2 },
  { type:'location', location:'cannock', minPlayers:2 },
  { type:'location', location:'tamworth', minPlayers:2 },
  { type:'location', location:'nuneaton', minPlayers:2 },
  { type:'location', location:'leek', minPlayers:2 },
  { type:'location', location:'leek', minPlayers:4 },
  { type:'location', location:'stoke-on-trent', minPlayers:2 },
  { type:'location', location:'stoke-on-trent', minPlayers:3 },
  { type:'location', location:'stoke-on-trent', minPlayers:4 },
  { type:'location', location:'stone', minPlayers:2 },
  { type:'location', location:'stone', minPlayers:3 },
  { type:'location', location:'uttoxeter', minPlayers:2 },
  { type:'location', location:'uttoxeter', minPlayers:3 },
  { type:'location', location:'stafford', minPlayers:2 },
  { type:'location', location:'burton', minPlayers:2 },
  { type:'location', location:'burton', minPlayers:3 },
  { type:'location', location:'derby', minPlayers:2 },
  { type:'location', location:'belper', minPlayers:2 },
  { type:'location', location:'redditch', minPlayers:2 },

  // === 產業牌 (28張 for 4人) ===
  { type:'industry', industry:T.COTTON, minPlayers:2 },
  { type:'industry', industry:T.COTTON, minPlayers:2 },
  { type:'industry', industry:T.COTTON, minPlayers:2 },
  { type:'industry', industry:T.COTTON, minPlayers:3 },
  { type:'industry', industry:T.COTTON, minPlayers:3 },
  { type:'industry', industry:T.COTTON, minPlayers:3 },
  { type:'industry', industry:T.COTTON, minPlayers:4 },
  { type:'industry', industry:T.MANUFACTURER, minPlayers:2 },
  { type:'industry', industry:T.MANUFACTURER, minPlayers:2 },
  { type:'industry', industry:T.MANUFACTURER, minPlayers:2 },
  { type:'industry', industry:T.MANUFACTURER, minPlayers:2 },
  { type:'industry', industry:T.MANUFACTURER, minPlayers:4 },
  { type:'industry', industry:T.COAL, minPlayers:2 },
  { type:'industry', industry:T.COAL, minPlayers:2 },
  { type:'industry', industry:T.COAL, minPlayers:3 },
  { type:'industry', industry:T.COAL, minPlayers:4 },
  { type:'industry', industry:T.IRON, minPlayers:2 },
  { type:'industry', industry:T.IRON, minPlayers:2 },
  { type:'industry', industry:T.IRON, minPlayers:3 },
  { type:'industry', industry:T.IRON, minPlayers:4 },
  { type:'industry', industry:T.BREWERY, minPlayers:2 },
  { type:'industry', industry:T.BREWERY, minPlayers:2 },
  { type:'industry', industry:T.BREWERY, minPlayers:3 },
  { type:'industry', industry:T.BREWERY, minPlayers:3 },
  { type:'industry', industry:T.BREWERY, minPlayers:4 },
  { type:'industry', industry:T.POTTERY, minPlayers:2 },
  { type:'industry', industry:T.POTTERY, minPlayers:3 },
  { type:'industry', industry:T.POTTERY, minPlayers:4 },
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck(playerCount) {
  // 只保留 minPlayers <= playerCount 的牌
  let filtered = allCards
    .filter(c => c.minPlayers <= playerCount);

  // 2人遊戲額外加1張牌（官方牌組2人=40張）
  if (playerCount === 2) {
    filtered.push({ type:'location', location:'birmingham' });
  }

  filtered = filtered.map(c => {
      const card = { type: c.type };
      if (c.type === 'location') {
        card.location = c.location;
        card.name = locations[c.location] ? locations[c.location].name : c.location;
      } else {
        card.industry = c.industry;
        card.name = c.industry.charAt(0).toUpperCase() + c.industry.slice(1);
      }
      return card;
    });

  return shuffle(filtered);
}

function dealCards(deck, count) {
  return deck.splice(0, count);
}

module.exports = { createDeck, dealCards, shuffle };
