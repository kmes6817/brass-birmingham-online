// Action handlers for Brass: Birmingham
// All 6 actions: build, network, develop, sell, loan, scout

const { ERAS, CANAL_LINK_COST, RAIL_LINK_COST, LOAN_AMOUNT, INCOME_TRACK, getIncomeLevel, loanDecreasePosition, COAL_MARKET_PRICES, COAL_MARKET_SIZE, IRON_MARKET_PRICES, IRON_MARKET_SIZE } = require('./data/constants');
const { consumeCoal, consumeIron, findBeer, applyConsumption, getConnectedLocations, playerHasBuildings, getPlayerNetwork, getIronSellPrice, getCoalSellPrice } = require('./market');
const { merchants } = require('./data/board');
const { connections } = require('./data/board');

// 處理 applyConsumption 回傳的所有翻面：推進收入軌
function processFlips(gameState, flips) {
  for (const flip of flips) {
    if (flip.flipped && flip.owner) {
      const owner = gameState.players[flip.owner];
      if (owner) {
        owner.trackPos = Math.min(owner.trackPos + flip.income, INCOME_TRACK.length - 1);
      }
    }
  }
}

// Validate and execute BUILD action
function executeBuild(gameState, playerId, params) {
  const { cardIndex, locationId, slotIndex, industryType } = params;
  const player = gameState.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) return { success: false, reason: '無效的卡牌' };

  const location = gameState.board[locationId];
  if (!location) return { success: false, reason: '無效的地點' };

  const slot = location.slots[slotIndex];
  if (!slot) return { success: false, reason: '無效的格子' };

  // Check if slot accepts this industry type
  if (!slot.types.includes(industryType)) {
    return { success: false, reason: `此格子不接受 ${industryType}` };
  }

  // Check card validity（萬能牌可以當任何牌用）
  if (card.type === 'location' && card.location !== 'wild' && card.location !== locationId) {
    return { success: false, reason: '地點牌與選擇的城市不符' };
  }
  if (card.type === 'industry' && card.industry !== 'wild' && card.industry !== industryType) {
    return { success: false, reason: '產業牌與選擇的產業不符' };
  }

  // 農莊啤酒廠限制：只能用啤酒產業牌或萬能產業牌建造
  if (location.isFarmBrewery) {
    if (card.type !== 'industry' && card.type !== 'wild_industry') {
      return { success: false, reason: '農莊啤酒廠只能用啤酒產業牌或萬能產業牌建造' };
    }
  }

  // Check if slot is empty or can be overbuilt
  if (slot.built) {
    // Overbuilding rules: can only overbuild own tile with a higher-level tile of the same type
    if (slot.built.owner !== playerId) {
      return { success: false, reason: '不能覆蓋其他玩家的建築' };
    }
    // 必須是同產業類型
    if (slot.built.type !== industryType) {
      return { success: false, reason: `覆蓋建築必須是相同產業類型（現有 ${slot.built.type}，你選 ${industryType}）` };
    }
    // 不能覆蓋還有資源的板塊（煤/鐵/啤酒方塊尚未消耗完）
    if (slot.built.resources > 0) {
      return { success: false, reason: '不能覆蓋還有資源方塊的建築（需先消耗完畢）' };
    }
    // 新板塊等級必須高於現有板塊（在找到可用 tile 後再檢查）
  }

  // 運河時代限制：每個玩家在同一城市只能有 1 個建築
  if (gameState.era === ERAS.CANAL) {
    const myTilesInCity = location.slots.filter(s =>
      s.built && s.built.owner === playerId && s.id !== slot.id
    );
    if (myTilesInCity.length > 0) {
      return { success: false, reason: '運河時代每個城市只能蓋 1 個你的建築！' };
    }
  }

  // Check network access
  // 地點牌/萬能地點牌：不需要網路（可以蓋在指定城市）
  // 產業牌/萬能產業牌：必須在自己的網路上
  // 第一次蓋（場上沒有任何建築和路線）：任何牌都可以蓋任何地方
  const hasBuildings = playerHasBuildings(gameState, playerId);
  if (hasBuildings) {
    const needsNetwork = (card.type === 'industry' || card.type === 'wild_industry');
    if (needsNetwork) {
      const network = getPlayerNetwork(gameState, playerId);
      if (!network.has(locationId)) {
        return { success: false, reason: '該地點不在你的網路上（產業牌需要網路連接）' };
      }
    }
    // Location card / wild_location: 不需要網路
  }

  // Find the lowest available tile of this type
  const playerTiles = player.tiles[industryType];
  if (!playerTiles || playerTiles.length === 0) {
    return { success: false, reason: `沒有剩餘的 ${industryType} 板塊` };
  }

  // Find lowest level tile that's valid for current era
  const tileIndex = playerTiles.findIndex(t => {
    if (t.era === 'canal' && gameState.era !== ERAS.CANAL) return false;
    if (t.era === 'rail' && gameState.era !== ERAS.RAIL) return false;
    return true;
  });

  if (tileIndex === -1) {
    return { success: false, reason: `目前時代沒有可用的 ${industryType} 板塊` };
  }

  const tile = playerTiles[tileIndex];

  // 覆蓋建築時，新板塊等級必須高於現有板塊
  if (slot.built && tile.level <= slot.built.level) {
    return { success: false, reason: `覆蓋建築需要更高等級（現有 Lv${slot.built.level}，你的 Lv${tile.level}）` };
  }

  // 先計算煤/鐵市場費用（不先扣錢）
  const coalResult = consumeCoal(gameState, locationId, tile.coalCost, playerId);
  if (!coalResult.success) return coalResult;

  const ironResult = consumeIron(gameState, tile.ironCost);
  if (!ironResult.success) return ironResult;

  // 檢查總費用（建造 + 買煤 + 買鐵）
  const totalCostBuild = tile.cost + coalResult.cost + ironResult.cost;
  if (player.money < totalCostBuild) {
    return { success: false, reason: `金錢不足（建造 £${tile.cost} + 市場資源 £${coalResult.cost + ironResult.cost} = 總計 £${totalCostBuild}，目前 £${player.money}）` };
  }

  // 扣錢
  player.money -= totalCostBuild;

  // Apply resource consumption
  const coalFlips = applyConsumption(gameState, coalResult.sources);
  const ironFlips = applyConsumption(gameState, ironResult.sources);
  processFlips(gameState, coalFlips);
  processFlips(gameState, ironFlips);

  // Remove tile from supply and place on board
  playerTiles.splice(tileIndex, 1);
  const builtTile = {
    ...tile,
    owner: playerId,
    ownerName: player.name,
    resources: tile.resourceAmount || 0
  };
  slot.built = builtTile;

  // === 煤炭/鐵方塊自動賣到市場 ===
  // 鐵廠：永遠自動賣（鐵是全域的）
  // 煤礦：只有連接到商人圖標時才自動賣
  let soldToMarket = 0;
  let marketIncome = 0;

  if (industryType === 'iron' && builtTile.resources > 0) {
    // 鐵永遠自動賣到市場（填入最貴的空格，玩家收那格的錢）
    while (builtTile.resources > 0 && gameState.ironMarket < IRON_MARKET_SIZE) {
      const price = getIronSellPrice(gameState.ironMarket);
      gameState.ironMarket++;
      builtTile.resources--;
      marketIncome += price;
      soldToMarket++;
    }
  } else if (industryType === 'coal' && builtTile.resources > 0) {
    // 煤礦：檢查是否連接到商人位置
    const connectedLocs = getConnectedLocations(gameState, locationId, playerId);
    let connectedToMerchant = false;
    for (const m of gameState.merchants) {
      if (!m.active) continue;
      for (const mCity of m.connectedTo) {
        if (connectedLocs.has(mCity)) { connectedToMerchant = true; break; }
      }
      if (connectedToMerchant) break;
    }
    if (connectedToMerchant) {
      while (builtTile.resources > 0 && gameState.coalMarket < COAL_MARKET_SIZE) {
        const price = getCoalSellPrice(gameState.coalMarket);
        gameState.coalMarket++;
        builtTile.resources--;
        marketIncome += price;
        soldToMarket++;
      }
    }
  }

  if (marketIncome > 0) {
    player.money += marketIncome;
  }

  // 如果方塊全部賣到市場了，立即翻面
  if (builtTile.resources <= 0 && soldToMarket > 0 && !builtTile.flipped) {
    if (['coal', 'iron'].includes(industryType)) {
      builtTile.flipped = true;
      builtTile.resources = 0;
      player.trackPos = Math.min(player.trackPos + builtTile.income, INCOME_TRACK.length - 1);
    }
  }

  // Discard card
  player.hand.splice(cardIndex, 1);

  let msg = `在 ${location.name} 建造了 ${industryType} 等級${tile.level}`;
  if (soldToMarket > 0) {
    msg += `（${soldToMarket}個方塊賣到市場，獲得 £${marketIncome}）`;
  }

  return {
    success: true,
    message: msg
  };
}

// Validate and execute NETWORK action
function executeNetwork(gameState, playerId, params) {
  const { cardIndex, links: linkPlacements } = params;
  const player = gameState.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) return { success: false, reason: '無效的卡牌' };

  const isCanal = gameState.era === ERAS.CANAL;
  const maxLinks = isCanal ? 1 : 2;

  if (!linkPlacements || linkPlacements.length === 0 || linkPlacements.length > maxLinks) {
    return { success: false, reason: `必須放置 1-${maxLinks} 條路線` };
  }

  // 雙鐵路時，兩條路線必須共用一個端點（相連）
  if (linkPlacements.length === 2) {
    const [a, b] = linkPlacements;
    const shared = (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to);
    if (!shared) {
      return { success: false, reason: '兩條鐵路必須相連（共用一個端點）' };
    }
    // 不能選同一條路線
    const same = (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);
    if (same) {
      return { success: false, reason: '不能選擇相同的路線兩次' };
    }
  }

  // 費用計算：
  // 運河：每條 £3，不需煤
  // 鐵路1條：£5 + 1煤
  // 鐵路2條：£15 + 2煤 + 1啤酒
  let totalCost, coalNeeded, beerNeeded;
  if (isCanal) {
    totalCost = linkPlacements.length * CANAL_LINK_COST; // £3 each
    coalNeeded = 0;
    beerNeeded = 0;
  } else {
    if (linkPlacements.length === 1) {
      totalCost = 5;
      coalNeeded = 1;
      beerNeeded = 0;
    } else {
      totalCost = 15; // 2 rails = £15
      coalNeeded = 2;  // 2 coal
      beerNeeded = 1;  // 1 beer
    }
  }

  if (player.money < totalCost) {
    return { success: false, reason: `金錢不足（需要 £${totalCost}）` };
  }

  // 網路連接檢查：玩家的路線至少一端必須在自己的網路上
  // 場上無建築/路線時免除此限制
  const hasPresence = playerHasBuildings(gameState, playerId);
  let playerNetwork = null;
  if (hasPresence) {
    playerNetwork = getPlayerNetwork(gameState, playerId);
  }

  for (let i = 0; i < linkPlacements.length; i++) {
    const lp = linkPlacements[i];
    // Check connection exists
    const conn = connections.find(c =>
      (c.from === lp.from && c.to === lp.to) ||
      (c.from === lp.to && c.to === lp.from)
    );
    if (!conn) {
      return { success: false, reason: `${lp.from} 和 ${lp.to} 之間沒有路線` };
    }

    // Check era compatibility
    if (isCanal && conn.type === 'rail') {
      return { success: false, reason: '此路線僅限鐵路，不能建運河' };
    }
    if (!isCanal && conn.type === 'canal') {
      return { success: false, reason: '此路線僅限運河，不能建鐵路' };
    }

    // Check if link already exists
    const existing = gameState.links.find(l =>
      (l.from === lp.from && l.to === lp.to) ||
      (l.from === lp.to && l.to === lp.from)
    );
    if (existing) {
      return { success: false, reason: `${lp.from} 和 ${lp.to} 之間已有路線` };
    }

    // 網路連接檢查
    if (playerNetwork) {
      const connected = playerNetwork.has(lp.from) || playerNetwork.has(lp.to);
      if (!connected) {
        return { success: false, reason: `路線 ${lp.from}↔${lp.to} 不在你的網路上（至少一端需連接到你的網路）` };
      }
      // 第一條路建好後，擴展網路讓第二條路可以接著建
      playerNetwork.add(lp.from);
      playerNetwork.add(lp.to);
    }
  }

  // 消耗煤炭（鐵路用）— 從所有 link 端點搜尋
  let coalMarketCost = 0;
  let coalSources = null;
  if (coalNeeded > 0) {
    // 收集所有端點作為候選搜尋起點
    const endpoints = [];
    for (const lp of linkPlacements) {
      if (!endpoints.includes(lp.from)) endpoints.push(lp.from);
      if (!endpoints.includes(lp.to)) endpoints.push(lp.to);
    }

    let coalResult = null;
    for (const ep of endpoints) {
      coalResult = consumeCoal(gameState, ep, coalNeeded, playerId);
      if (coalResult.success) break;
    }
    if (!coalResult || !coalResult.success) {
      return coalResult || { success: false, reason: '找不到足夠的煤炭' };
    }
    coalMarketCost = coalResult.cost;
    coalSources = coalResult.sources;

    // 檢查加上煤的費用後是否還夠
    if (player.money < totalCost + coalMarketCost) {
      return { success: false, reason: `金錢不足（路線 £${totalCost} + 煤 £${coalMarketCost} = £${totalCost + coalMarketCost}，目前 £${player.money}）` };
    }
  }

  // 消耗啤酒（雙鐵路用，必須來自啤酒廠，不能用商人啤酒）
  if (beerNeeded > 0) {
    // 從所有 link 端點搜尋啤酒
    const beerEndpoints = [];
    for (const lp of linkPlacements) {
      if (!beerEndpoints.includes(lp.from)) beerEndpoints.push(lp.from);
      if (!beerEndpoints.includes(lp.to)) beerEndpoints.push(lp.to);
    }
    let beerResult = null;
    for (const ep of beerEndpoints) {
      beerResult = findBeer(gameState, ep, beerNeeded, playerId, null);
      if (beerResult.success) break;
    }
    if (!beerResult || !beerResult.success) return { success: false, reason: '建造雙鐵路需要 1 桶啤酒，但找不到可用的啤酒廠' };

    const beerFlips = applyConsumption(gameState, beerResult.sources);
    processFlips(gameState, beerFlips);
  }

  // 扣錢（路線 + 煤市場費用）
  player.money -= totalCost + coalMarketCost;

  // 應用煤炭消耗
  if (coalSources) {
    const coalFlips = applyConsumption(gameState, coalSources);
    processFlips(gameState, coalFlips);
  }

  for (const lp of linkPlacements) {
    gameState.links.push({
      from: lp.from,
      to: lp.to,
      owner: playerId,
      type: isCanal ? 'canal' : 'rail'
    });
  }

  player.hand.splice(cardIndex, 1);

  return {
    success: true,
    message: `建造了 ${linkPlacements.length} 條${isCanal ? '運河' : '鐵路'}`
  };
}

// Validate and execute DEVELOP action
function executeDevelop(gameState, playerId, params) {
  const { cardIndex, industryTypes } = params; // industryTypes: array of 1-2 types to develop
  const player = gameState.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) return { success: false, reason: '無效的卡牌' };

  if (!industryTypes || industryTypes.length === 0 || industryTypes.length > 2) {
    return { success: false, reason: '必須研發 1-2 種產業' };
  }

  // Each develop removes the lowest tile and costs 1 iron
  const totalIron = industryTypes.length;
  const ironResult = consumeIron(gameState, totalIron);
  if (!ironResult.success) return ironResult;

  // Check tiles exist and can be developed
  for (const type of industryTypes) {
    if (!player.tiles[type] || player.tiles[type].length === 0) {
      return { success: false, reason: `沒有 ${type} 板塊可研發` };
    }
    // 有燈泡圖標的板塊不能研發（陶瓷 Lv1, Lv3, Lv5）
    if (player.tiles[type][0].noDevelop) {
      return { success: false, reason: `${type} 目前最低等級的板塊有💡標記，不能研發！必須透過建造行動移除。` };
    }
  }

  // 檢查鐵的市場費用
  if (player.money < ironResult.cost) {
    return { success: false, reason: `金錢不足（需要 £${ironResult.cost} 買鐵，目前 £${player.money}）` };
  }

  // Execute
  player.money -= ironResult.cost;
  const ironFlips = applyConsumption(gameState, ironResult.sources);
  processFlips(gameState, ironFlips);

  const removed = [];
  for (const type of industryTypes) {
    const tile = player.tiles[type].shift(); // Remove lowest level
    removed.push(`${type} lv${tile.level}`);
  }

  player.hand.splice(cardIndex, 1);

  return {
    success: true,
    message: `研發：移除了 ${removed.join('、')}`
  };
}

// 找到某個位置能連到的商人（必須有實際蓋好的路線連到商人）
function findReachableMerchants(gameState, locationId, industryType) {
  // BFS 從產業所在城市出發，透過所有已建路線，看能不能到達商人位置
  const connected = getConnectedLocations(gameState, locationId, null);
  const reachable = [];

  const merchantList = gameState.merchants || merchants;
  for (const merchant of merchantList) {
    if (!merchant.active) continue;
    // 只考慮有未使用且接受此產業類型的 tile 的商人
    const hasUnusedSlot = merchant.tiles && merchant.tiles.some(t => !t.used && t.accepts.includes(industryType));
    if (!hasUnusedSlot) continue;
    // 檢查商人位置（merchant.id）是否在 BFS 可達範圍內
    if (connected.has(merchant.id)) {
      reachable.push(merchant);
    }
  }
  return reachable;
}

// Validate and execute SELL action
function executeSell(gameState, playerId, params) {
  const { cardIndex, sales } = params;
  const player = gameState.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) return { success: false, reason: '無效的卡牌' };
  if (!sales || sales.length === 0) return { success: false, reason: '必須選擇至少一個產業來販賣' };

  // 檢查重複（同一個 locationId + slotIndex 不能出現兩次）
  const saleKeys = new Set();
  for (const sale of sales) {
    const key = `${sale.locationId}:${sale.slotIndex}`;
    if (saleKeys.has(key)) {
      return { success: false, reason: '不能重複選擇同一個建築' };
    }
    saleKeys.add(key);
  }

  // Validate all sales first
  for (const sale of sales) {
    const loc = gameState.board[sale.locationId];
    if (!loc) return { success: false, reason: '無效的地點' };

    const slot = loc.slots[sale.slotIndex];
    if (!slot || !slot.built) return { success: false, reason: '該格沒有建築' };
    if (slot.built.owner !== playerId) return { success: false, reason: '這不是你的建築' };
    if (slot.built.flipped) return { success: false, reason: '此產業已經販賣過了' };

    const type = slot.built.type;
    if (!['cotton', 'manufacturer', 'pottery'].includes(type)) {
      return { success: false, reason: `${type} 類型不能販賣` };
    }

    // 檢查是否能連接到接受此產業的商人
    const reachable = findReachableMerchants(gameState, sale.locationId, type);
    if (reachable.length === 0) {
      return { success: false, reason: `${loc.name} 的 ${type} 無法連接到任何接受此商品的商人！需要透過路線連接到外部市場。` };
    }
  }

  // 找到每個販賣對應的商人（用來取商人啤酒）
  const saleToMerchant = [];
  for (const sale of sales) {
    const loc = gameState.board[sale.locationId];
    const slot = loc.slots[sale.slotIndex];
    const type = slot.built.type;
    const reachable = findReachableMerchants(gameState, sale.locationId, type);
    // 優先選有啤酒的商人
    const withBeer = reachable.find(m => m.beer > 0) || reachable[0];
    saleToMerchant.push(withBeer);
  }

  // 計算啤酒需求，嘗試使用商人啤酒
  let totalBeer = 0;
  for (const sale of sales) {
    const loc = gameState.board[sale.locationId];
    const slot = loc.slots[sale.slotIndex];
    totalBeer += slot.built.sellBeer || 0;
  }

  // 找啤酒來源（從所有販賣位置搜尋，包含商人啤酒）
  let usedMerchantBeer = null; // 記錄用了哪個商人的啤酒
  if (totalBeer > 0) {
    const merchantWithBeer = saleToMerchant.find(m => m && m.beer > 0);
    const merchantId = merchantWithBeer ? merchantWithBeer.id : null;

    // 從所有 sale 位置嘗試找啤酒（避免只從第一個位置搜尋而漏掉）
    let beerResult = null;
    for (const sale of sales) {
      beerResult = findBeer(gameState, sale.locationId, totalBeer, playerId, merchantId);
      if (beerResult.success) break;
    }
    if (!beerResult || !beerResult.success) {
      return beerResult || { success: false, reason: '找不到足夠的啤酒' };
    }

    // 檢查是否用了商人啤酒
    const merchantBeerSrc = beerResult.sources.find(s => s.merchantBeer);
    if (merchantBeerSrc) {
      usedMerchantBeer = (gameState.merchants || []).find(m => m.id === merchantBeerSrc.merchantId);
    }

    // 應用啤酒消耗
    const beerFlips = applyConsumption(gameState, beerResult.sources);
    processFlips(gameState, beerFlips);
  }

  // Flip sold tiles + 標記商人 tile 為已使用
  const soldNames = [];
  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];
    const loc = gameState.board[sale.locationId];
    const slot = loc.slots[sale.slotIndex];
    slot.built.flipped = true;
    player.trackPos = Math.min(player.trackPos + slot.built.income, INCOME_TRACK.length - 1);

    // 標記商人板塊已使用（每次販賣消耗一個商人 tile slot）
    const merchant = saleToMerchant[i];
    if (merchant && merchant.tiles) {
      const unusedTile = merchant.tiles.find(t => !t.used && t.accepts.includes(slot.built.type));
      if (unusedTile) {
        unusedTile.used = true;
      }
    }

    const d = { cotton: '棉花', manufacturer: '工廠', pottery: '陶瓷' };
    soldNames.push(`${loc.name} ${d[slot.built.type] || slot.built.type}`);
  }

  // === 商人啤酒獎勵 ===
  let bonusMsg = '';
  if (usedMerchantBeer && usedMerchantBeer.bonusType) {
    const m = usedMerchantBeer;
    switch (m.bonusType) {
      case 'vp':
        // Shrewsbury: +4分 / Nottingham: +3分
        player.vp = (player.vp || 0) + m.bonusAmount;
        bonusMsg = `（${m.name} 獎勵：+${m.bonusAmount} 分）`;
        break;

      case 'money':
        // Warrington: +£5
        player.money += m.bonusAmount;
        bonusMsg = `（${m.name} 獎勵：+£${m.bonusAmount}）`;
        break;

      case 'income':
        // Oxford: 收入+2格
        player.trackPos = Math.min(player.trackPos + m.bonusAmount, INCOME_TRACK.length - 1);
        bonusMsg = `（${m.name} 獎勵：收入 +${m.bonusAmount} 格）`;
        break;

      case 'develop':
        // Gloucester: 免費研發1個
        bonusMsg = `（${m.name} 獎勵：免費研發 1 個 — 請選擇）`;
        if (!gameState._pendingBonus) gameState._pendingBonus = {};
        gameState._pendingBonus[playerId] = {
          type: 'free-develop',
          merchantName: m.name
        };
        break;
    }
  }

  player.hand.splice(cardIndex, 1);

  return {
    success: true,
    message: `販賣了 ${soldNames.join('、')}${bonusMsg}`
  };
}

// Validate and execute LOAN action
function executeLoan(gameState, playerId, params) {
  const { cardIndex } = params;
  const player = gameState.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) return { success: false, reason: '無效的卡牌' };

  // 借貸：收入降 3（不是等級降 3），clamp 到最低 -10
  const oldIncome = getIncomeLevel(player.trackPos);
  const newPos = loanDecreasePosition(player.trackPos);
  const newIncome = getIncomeLevel(newPos);

  player.money += LOAN_AMOUNT;
  player.trackPos = newPos;

  player.hand.splice(cardIndex, 1);

  return {
    success: true,
    message: `貸款：+£${LOAN_AMOUNT}，收入 £${oldIncome} → £${newIncome}（格${player.trackPos}）`
  };
}

// Validate and execute SCOUT action
function executeScout(gameState, playerId, params) {
  const { cardIndices } = params; // Must discard 3 cards total
  const player = gameState.players[playerId];

  if (!cardIndices || cardIndices.length !== 3) {
    return { success: false, reason: '偵查需要棄掉 3 張手牌' };
  }

  // Validate all cards exist
  for (const idx of cardIndices) {
    if (!player.hand[idx]) return { success: false, reason: '無效的卡牌' };
  }

  // Remove cards (sort descending to maintain indices)
  const sorted = [...cardIndices].sort((a, b) => b - a);
  for (const idx of sorted) {
    player.hand.splice(idx, 1);
  }

  // Add wild cards (represented as special cards)
  player.hand.push({
    type: 'wild_location',
    name: 'Wild Location',
    location: 'wild'
  });
  player.hand.push({
    type: 'wild_industry',
    name: 'Wild Industry',
    industry: 'wild'
  });

  return {
    success: true,
    message: '偵查：獲得 1 張萬能地點牌 + 1 張萬能產業牌'
  };
}

module.exports = {
  executeBuild,
  executeNetwork,
  executeDevelop,
  executeSell,
  executeLoan,
  executeScout
};
