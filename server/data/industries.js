// 產業板塊定義 - Brass: Birmingham（已校正）
const { INDUSTRY_TYPES: T } = require('./constants');

const industryData = {
  [T.COTTON]: {
    name: '棉花工廠',
    tiles: [
      { level: 1, cost: 12, coalCost: 0, ironCost: 0, income: 5, vp: 5, linkVP: 1, sellBeer: 1, era: 'canal' },
      { level: 2, cost: 14, coalCost: 1, ironCost: 0, income: 4, vp: 5, linkVP: 2, sellBeer: 1, era: 'both' },
      { level: 3, cost: 16, coalCost: 1, ironCost: 1, income: 3, vp: 9, linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 4, cost: 18, coalCost: 1, ironCost: 1, income: 1, vp: 12, linkVP: 1, sellBeer: 0, era: 'both' }
    ],
    count: [3, 3, 3, 3] // total 12
  },

  [T.MANUFACTURER]: {
    name: '製造商',
    tiles: [
      { level: 1, cost: 8,  coalCost: 1, ironCost: 0, income: 5, vp: 3,  linkVP: 2, sellBeer: 1, era: 'canal' },
      { level: 2, cost: 10, coalCost: 0, ironCost: 1, income: 1, vp: 5,  linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 3, cost: 12, coalCost: 2, ironCost: 0, income: 4, vp: 4,  linkVP: 0, sellBeer: 1, era: 'rail' },
      { level: 4, cost: 8,  coalCost: 0, ironCost: 1, income: 6, vp: 3,  linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 5, cost: 16, coalCost: 1, ironCost: 0, income: 2, vp: 8,  linkVP: 2, sellBeer: 2, era: 'both' },
      { level: 6, cost: 20, coalCost: 0, ironCost: 0, income: 6, vp: 7,  linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 7, cost: 16, coalCost: 1, ironCost: 1, income: 4, vp: 9,  linkVP: 0, sellBeer: 0, era: 'both' },
      { level: 8, cost: 20, coalCost: 0, ironCost: 2, income: 1, vp: 11, linkVP: 1, sellBeer: 0, era: 'both' }
    ],
    count: [2, 1, 1, 1, 2, 1, 2, 1] // total 11
  },

  [T.COAL]: {
    name: '煤礦',
    textColor: '#FFFFFF',
    tiles: [
      { level: 1, cost: 5,  coalCost: 0, ironCost: 0, income: 4, vp: 1, linkVP: 2, resourceAmount: 2, era: 'canal' },
      { level: 2, cost: 7,  coalCost: 0, ironCost: 0, income: 7, vp: 2, linkVP: 1, resourceAmount: 3, era: 'both' },
      { level: 3, cost: 8,  coalCost: 0, ironCost: 1, income: 6, vp: 3, linkVP: 1, resourceAmount: 4, era: 'both' },
      { level: 4, cost: 10, coalCost: 0, ironCost: 1, income: 5, vp: 4, linkVP: 1, resourceAmount: 5, era: 'both' }
    ],
    count: [2, 2, 2, 1] // total 7
  },

  [T.IRON]: {
    name: '鐵工廠',
    tiles: [
      { level: 1, cost: 5,  coalCost: 1, ironCost: 0, income: 3, vp: 3, linkVP: 1, resourceAmount: 4, era: 'canal' },
      { level: 2, cost: 7,  coalCost: 1, ironCost: 0, income: 3, vp: 5, linkVP: 1, resourceAmount: 4, era: 'both' },
      { level: 3, cost: 9,  coalCost: 1, ironCost: 0, income: 2, vp: 7, linkVP: 1, resourceAmount: 5, era: 'both' },
      { level: 4, cost: 12, coalCost: 1, ironCost: 0, income: 1, vp: 9, linkVP: 1, resourceAmount: 6, era: 'both' }
    ],
    count: [1, 1, 1, 1] // total 4
  },

  [T.BREWERY]: {
    name: '啤酒廠',
    tiles: [
      { level: 1, cost: 5, coalCost: 0, ironCost: 1, income: 4, vp: 4,  linkVP: 2, resourceAmount: 1, era: 'canal' },
      { level: 2, cost: 7, coalCost: 0, ironCost: 1, income: 5, vp: 5,  linkVP: 2, resourceAmount: 1, era: 'both' },
      { level: 3, cost: 9, coalCost: 0, ironCost: 1, income: 5, vp: 7,  linkVP: 2, resourceAmount: 2, era: 'both' },
      { level: 4, cost: 9, coalCost: 0, ironCost: 1, income: 5, vp: 10, linkVP: 2, resourceAmount: 2, era: 'rail' }
    ],
    count: [2, 2, 2, 1] // total 7
  },

  [T.POTTERY]: {
    name: '陶瓷廠',
    tiles: [
      { level: 1, cost: 17, coalCost: 0, ironCost: 1, income: 5, vp: 10, linkVP: 1, sellBeer: 1, era: 'both', noDevelop: true },
      { level: 2, cost: 0,  coalCost: 1, ironCost: 0, income: 1, vp: 1,  linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 3, cost: 22, coalCost: 2, ironCost: 0, income: 5, vp: 11, linkVP: 1, sellBeer: 2, era: 'both', noDevelop: true },
      { level: 4, cost: 0,  coalCost: 1, ironCost: 0, income: 1, vp: 1,  linkVP: 1, sellBeer: 1, era: 'both' },
      { level: 5, cost: 24, coalCost: 2, ironCost: 0, income: 5, vp: 20, linkVP: 1, sellBeer: 2, era: 'rail', noDevelop: true }
    ],
    count: [1, 1, 1, 1, 1] // total 5
  }
};

// 建立玩家初始板塊
function createPlayerTiles() {
  const tiles = {};
  for (const [type, data] of Object.entries(industryData)) {
    tiles[type] = [];
    data.tiles.forEach((tileDef, index) => {
      const count = data.count[index] || 1;
      for (let i = 0; i < count; i++) {
        tiles[type].push({
          type,
          level: tileDef.level,
          cost: tileDef.cost,
          coalCost: tileDef.coalCost,
          ironCost: tileDef.ironCost,
          income: tileDef.income,
          vp: tileDef.vp,
          linkVP: tileDef.linkVP,
          sellBeer: tileDef.sellBeer || 0,
          resourceAmount: tileDef.resourceAmount || 0,
          era: tileDef.era,
          noDevelop: tileDef.noDevelop || false,
          flipped: false,
          resources: 0
        });
      }
    });
    tiles[type].sort((a, b) => a.level - b.level);
  }
  return tiles;
}

module.exports = { industryData, createPlayerTiles };
