// Coal and Iron market logic + resource consumption

const { COAL_MARKET_PRICES, COAL_MARKET_SIZE, IRON_MARKET_PRICES, IRON_MARKET_SIZE, IRON_MARKET_INITIAL } = require('./data/constants');

// 市場模型：
// 價格表由便宜→貴排列 [1,1,2,2,3,3,4,4,5,5,6,7,8,8]
// 方塊從「最貴端」開始佔位（初始13個煤炭佔 index 1-13，slot 0 空）
// 購買 = 拿走最便宜的方塊（cheapest filled slot）
// 賣到市場 = 填入最貴的空格（most expensive empty slot），玩家收錢

// 購買價格（從市場買走最便宜的那個）
function getCoalPrice(supply) {
  if (supply <= 0) return COAL_MARKET_PRICES[COAL_MARKET_SIZE - 1]; // 空了=最高價£8
  return COAL_MARKET_PRICES[COAL_MARKET_SIZE - supply]; // 最便宜的已填格
}

function getIronPrice(supply) {
  if (supply <= 0) return IRON_MARKET_PRICES[IRON_MARKET_SIZE - 1]; // 空了=最高價£6
  return IRON_MARKET_PRICES[IRON_MARKET_SIZE - supply];
}

// 賣到市場的價格（方塊回到市場時，填入最貴的空格）
function getCoalSellPrice(supply) {
  if (supply >= COAL_MARKET_SIZE) return 0; // 滿了
  return COAL_MARKET_PRICES[COAL_MARKET_SIZE - supply - 1];
}

function getIronSellPrice(supply) {
  if (supply >= IRON_MARKET_SIZE) return 0;
  return IRON_MARKET_PRICES[IRON_MARKET_SIZE - supply - 1];
}

// Find connected locations via player networks (BFS)
function getConnectedLocations(gameState, startLocation, playerId) {
  const visited = new Set();
  const queue = [startLocation];
  visited.add(startLocation);

  while (queue.length > 0) {
    const current = queue.shift();
    // Find all links from current location
    for (const link of gameState.links) {
      let neighbor = null;
      if (link.from === current) neighbor = link.to;
      else if (link.to === current) neighbor = link.from;

      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

// Find all locations in a player's network
// 網路 = 有你建築的城市 + 你路線相鄰的城市 + 透過所有人路線 BFS 可達的城市
function getPlayerNetwork(gameState, playerId) {
  const startPoints = new Set();

  // 1. 有你建築的城市
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built && slot.built.owner === playerId) {
        startPoints.add(locId);
      }
    }
  }

  // 2. 你的路線相鄰的城市
  for (const link of gameState.links) {
    if (link.owner === playerId) {
      startPoints.add(link.from);
      startPoints.add(link.to);
    }
  }

  // 3. 從所有起點 BFS（透過所有人的路線）
  const allConnected = new Set();
  for (const start of startPoints) {
    const connected = getConnectedLocations(gameState, start, playerId);
    connected.forEach(l => allConnected.add(l));
  }

  return allConnected;
}

// Check if player has any building or link on the board
function playerHasBuildings(gameState, playerId) {
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built && slot.built.owner === playerId) return true;
    }
  }
  // 也檢查路線
  if (gameState.links) {
    for (const link of gameState.links) {
      if (link.owner === playerId) return true;
    }
  }
  return false;
}

// BFS 計算從起點到各城市的距離（經過的路線數）
function getDistances(gameState, startLocation) {
  const dist = {};
  dist[startLocation] = 0;
  const queue = [startLocation];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const link of gameState.links) {
      let neighbor = null;
      if (link.from === current) neighbor = link.to;
      else if (link.to === current) neighbor = link.from;
      if (neighbor && dist[neighbor] === undefined) {
        dist[neighbor] = dist[current] + 1;
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

// 從最近的煤礦取煤，或從市場購買
function consumeCoal(gameState, location, amount, playerId) {
  if (amount <= 0) return { success: true, cost: 0, sources: [] };

  // BFS 計算距離
  const distances = getDistances(gameState, location);
  let remaining = amount;
  let totalCost = 0;
  const sources = [];

  // 找出所有連線可達的煤礦，按距離排序（最近優先）
  const coalSources = [];
  for (const [locId, loc] of Object.entries(gameState.board)) {
    if (distances[locId] === undefined) continue; // 不可達
    for (const slot of loc.slots) {
      if (slot.built && slot.built.type === 'coal' && slot.built.resources > 0) {
        coalSources.push({ locId, slot, distance: distances[locId] });
      }
    }
  }
  // 也包含起始位置本身（距離0）
  if (distances[location] === undefined) {
    // 起始位置沒有在 BFS 中（沒有路線時）
    const loc = gameState.board[location];
    if (loc) {
      for (const slot of loc.slots) {
        if (slot.built && slot.built.type === 'coal' && slot.built.resources > 0) {
          coalSources.push({ locId: location, slot, distance: 0 });
        }
      }
    }
  }

  // 按距離排序（最近優先）
  coalSources.sort((a, b) => a.distance - b.distance);

  for (const cs of coalSources) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, cs.slot.built.resources);
    sources.push({ location: cs.locId, slotId: cs.slot.id, amount: take });
    remaining -= take;
  }

  // Then buy from market（需要連到商人圖標才能從市場買煤）
  if (remaining > 0) {
    // 檢查是否連到任何商人位置
    let connectedToMerchant = false;
    for (const key of Object.keys(distances)) {
      if (key.startsWith('merchant-')) { connectedToMerchant = true; break; }
    }
    // 起始位置也檢查（沒路線時只有自己）
    if (!connectedToMerchant && location.startsWith('merchant-')) connectedToMerchant = true;

    if (!connectedToMerchant) {
      return { success: false, reason: '無法從市場購買煤炭：需要透過路線連接到商人圖標' };
    }

    for (let i = 0; i < remaining; i++) {
      if (gameState.coalMarket <= 0) {
        return { success: false, reason: '煤炭不足（市場和板塊都沒有）' };
      }
      totalCost += getCoalPrice(gameState.coalMarket);
      gameState.coalMarket--;
    }
    sources.push({ market: true, amount: remaining });
  }

  return { success: true, cost: totalCost, sources };
}

// Consume iron - iron is global (no network needed), but board first then market
function consumeIron(gameState, amount) {
  if (amount <= 0) return { success: true, cost: 0, sources: [] };

  let remaining = amount;
  let totalCost = 0;
  const sources = [];

  // First get iron from any iron works on board
  for (const [locId, loc] of Object.entries(gameState.board)) {
    if (remaining <= 0) break;
    for (const slot of loc.slots) {
      if (remaining <= 0) break;
      if (slot.built && slot.built.type === 'iron' && slot.built.resources > 0) {
        const take = Math.min(remaining, slot.built.resources);
        sources.push({ location: locId, slotId: slot.id, amount: take });
        remaining -= take;
      }
    }
  }

  // Then buy from market
  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      if (gameState.ironMarket <= 0) {
        return { success: false, reason: '鐵不足' };
      }
      totalCost += getIronPrice(gameState.ironMarket);
      gameState.ironMarket--;
    }
    sources.push({ market: true, amount: remaining });
  }

  return { success: true, cost: totalCost, sources };
}

// 找啤酒來源（用於販賣和雙鐵路）
// 規則：1. 自己的啤酒廠（不需要連接）2. 對手的啤酒廠（需要連接）3. 商人旁的啤酒桶
// merchantId: 如果是販賣到特定商人，可以用商人的啤酒
function findBeer(gameState, location, amount, playerId, merchantId) {
  if (amount <= 0) return { success: true, sources: [] };

  const connected = getConnectedLocations(gameState, location, playerId);
  let remaining = amount;
  const sources = [];

  // 1. 自己的啤酒廠（不需要網路連接！）
  for (const [locId, loc] of Object.entries(gameState.board)) {
    if (remaining <= 0) break;
    for (const slot of loc.slots) {
      if (remaining <= 0) break;
      if (slot.built && slot.built.type === 'brewery' &&
          slot.built.resources > 0 && slot.built.owner === playerId) {
        const take = Math.min(remaining, slot.built.resources);
        sources.push({ location: locId, slotId: slot.id, amount: take });
        remaining -= take;
      }
    }
  }

  // 2. 對手的啤酒廠（需要網路連接）
  for (const locId of connected) {
    if (remaining <= 0) break;
    const loc = gameState.board[locId];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (remaining <= 0) break;
      if (slot.built && slot.built.type === 'brewery' &&
          slot.built.resources > 0 && slot.built.owner !== playerId) {
        const take = Math.min(remaining, slot.built.resources);
        sources.push({ location: locId, slotId: slot.id, amount: take });
        remaining -= take;
      }
    }
  }

  // 3. 商人旁的啤酒桶（僅限販賣動作）
  if (remaining > 0 && merchantId && gameState.merchants) {
    const merchant = gameState.merchants.find(m => m.id === merchantId);
    if (merchant && merchant.beer > 0) {
      const take = Math.min(remaining, merchant.beer);
      sources.push({ merchantBeer: true, merchantId: merchantId, amount: take });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    return { success: false, reason: '沒有足夠的啤酒（自己的啤酒廠不需連接，對手的需要連接）' };
  }

  return { success: true, sources };
}

// Apply resource consumption (actually remove cubes)
// 從板塊拿走的煤炭/鐵會回到市場（啤酒不會）
function applyConsumption(gameState, sources) {
  const flips = [];
  for (const src of sources) {
    if (src.market) continue;
    // 商人啤酒消耗
    if (src.merchantBeer) {
      const merchant = gameState.merchants.find(m => m.id === src.merchantId);
      if (merchant) merchant.beer -= src.amount;
      continue;
    }
    const loc = gameState.board[src.location];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.id === src.slotId && slot.built) {
        const resType = slot.built.type;
        slot.built.resources -= src.amount;

        // 煤炭和鐵從板塊消耗後回到市場（啤酒不回市場）
        if (resType === 'coal') {
          gameState.coalMarket = Math.min(gameState.coalMarket + src.amount, COAL_MARKET_SIZE);
        } else if (resType === 'iron') {
          gameState.ironMarket = Math.min(gameState.ironMarket + src.amount, IRON_MARKET_SIZE);
        }

        // Auto-flip resource industries when emptied
        if (slot.built.resources <= 0 && !slot.built.flipped) {
          if (['coal', 'iron', 'brewery'].includes(resType)) {
            slot.built.flipped = true;
            slot.built.resources = 0;
            flips.push({ flipped: true, owner: slot.built.owner, income: slot.built.income });
          }
        }
      }
    }
  }
  return flips.length > 0 ? flips[0] : { flipped: false };
}

module.exports = {
  getCoalPrice,
  getIronPrice,
  getCoalSellPrice,
  getIronSellPrice,
  getConnectedLocations,
  getPlayerNetwork,
  playerHasBuildings,
  consumeCoal,
  consumeIron,
  findBeer,
  applyConsumption
};
