// Core game state machine for Brass: Birmingham

const { locations, connections, merchants } = require('./data/board');
const { createPlayerTiles } = require('./data/industries');
const { ERAS, STARTING_MONEY, STARTING_TRACK_POS, INCOME_TRACK, getIncomeLevel, HAND_SIZE, ACTIONS_PER_TURN, COAL_MARKET_INITIAL, IRON_MARKET_INITIAL } = require('./data/constants');
const { createDeck, dealCards } = require('./cards');
const { scoreCanalEra, scoreRailEra, calculateTurnOrder } = require('./scoring');
const { executeBuild, executeNetwork, executeDevelop, executeSell, executeLoan, executeScout } = require('./actions');
const { getPlayerNetwork } = require('./market');

class BrassGame {
  constructor(playerInfos) {
    // playerInfos: [{ id, name }, ...]
    this.playerCount = playerInfos.length;
    this.era = ERAS.CANAL;
    this.round = 1;
    this.firstTurn = true; // First turn of game: only 1 action
    this.gameOver = false;
    this.winner = null;
    this.log = [];

    // Initialize board (deep copy)
    this.board = {};
    for (const [id, loc] of Object.entries(locations)) {
      this.board[id] = {
        name: loc.name,
        slots: (loc.slots || []).map(s => ({ ...s, built: null }))
      };
    }

    // Initialize links
    this.links = [];

    // Initialize markets
    this.coalMarket = COAL_MARKET_INITIAL; // 13
    this.ironMarket = IRON_MARKET_INITIAL; // 8

    // Initialize players
    this.players = {};
    // 隨機起始行動順序
    this.turnOrder = playerInfos.map(p => p.id);
    for (let i = this.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
    }

    for (const pi of playerInfos) {
      this.players[pi.id] = {
        id: pi.id,
        name: pi.name,
        money: STARTING_MONEY[this.playerCount] || 30,
        trackPos: STARTING_TRACK_POS, // 格10 = 收入等級0 = 每回合收£0
        vp: 0,
        hand: [],
        tiles: createPlayerTiles(),
        actionsThisTurn: 0,
        spentThisRound: 0
      };
    }

    // Create and deal cards
    // 規則：每人抽 8 張手牌 + 額外抽 1 張放到棄牌堆
    this.deck = createDeck(this.playerCount);
    for (const pid of this.turnOrder) {
      this.players[pid].hand = dealCards(this.deck, HAND_SIZE);
      // 額外棄 1 張（從牌庫抽但不放入手牌）
      if (this.deck.length > 0) dealCards(this.deck, 1);
    }

    this.currentPlayerIndex = 0;

    // 設置商人（隨機板塊 + 每個商人旁邊 1 桶啤酒）
    this.merchants = structuredClone(merchants);
    this.setupMerchants();

    this.addLog(`遊戲開始！共 ${this.playerCount} 位玩家`);
    this.addLog(`=== 運河時代開始 ===`);
    this.addLog(`${this.getCurrentPlayer().name} 的回合（首回合僅 1 個行動）`);
  }

  setupMerchants() {
    const { INDUSTRY_TYPES: T } = require('./data/constants');

    // 貿易商板塊池
    // 貨物=manufacturer, 棉花=cotton, 陶瓷=pottery, 休市=closed
    let tilePool;
    if (this.playerCount >= 4) {
      // 4人：9片
      tilePool = [
        'closed', 'closed', 'closed',
        'manufacturer', 'manufacturer',
        'cotton', 'cotton',
        'pottery',
        'wild' // (貨物/棉花/陶瓷) 萬用
      ];
    } else if (this.playerCount === 3) {
      // 3人：7片（關閉 Nottingham）
      tilePool = [
        'closed', 'closed', 'closed',
        'manufacturer',
        'cotton',
        'pottery',
        'wild'
      ];
    } else {
      // 2人：5片（關閉 Warrington + Nottingham）
      tilePool = [
        'closed', 'closed',
        'manufacturer',
        'cotton',
        'wild'
      ];
    }

    // 洗牌
    for (let i = tilePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tilePool[i], tilePool[j]] = [tilePool[j], tilePool[i]];
    }

    // 每個商人位置的板塊格數（依人數）
    const slotsPerMerchant = {
      'merchant-shrewsbury': this.playerCount >= 4 ? 2 : this.playerCount >= 3 ? 2 : 1,
      'merchant-gloucester':  this.playerCount >= 4 ? 2 : this.playerCount >= 3 ? 2 : 1,
      'merchant-oxford':      this.playerCount >= 4 ? 2 : this.playerCount >= 3 ? 1 : 1,
      'merchant-warrington':  this.playerCount >= 4 ? 2 : this.playerCount >= 3 ? 2 : 0,
      'merchant-nottingham':  this.playerCount >= 4 ? 1 : 0,
    };

    for (const m of this.merchants) {
      const numSlots = slotsPerMerchant[m.id] || 0;
      if (numSlots === 0) {
        m.active = false;
        m.accepts = [];
        m.tiles = [];
        m.beer = 0;
        continue;
      }

      m.active = true;
      m.tiles = []; // 每個板塊格獨立
      m.accepts = []; // 彙總所有接受的類型

      for (let s = 0; s < numSlots; s++) {
        const tile = tilePool.pop() || 'closed';
        let accepts;
        let hasBeer;

        if (tile === 'closed') {
          accepts = [];
          hasBeer = false;
        } else if (tile === 'wild') {
          accepts = [T.MANUFACTURER, T.COTTON, T.POTTERY];
          hasBeer = true;
        } else if (tile === 'manufacturer') {
          accepts = [T.MANUFACTURER];
          hasBeer = true;
        } else if (tile === 'cotton') {
          accepts = [T.COTTON];
          hasBeer = true;
        } else if (tile === 'pottery') {
          accepts = [T.POTTERY];
          hasBeer = true;
        } else {
          accepts = [];
          hasBeer = false;
        }

        m.tiles.push({
          type: tile,
          accepts,
          beer: hasBeer ? 1 : 0,
          used: false // 販賣後標記已用
        });

        // 彙總
        for (const a of accepts) {
          if (!m.accepts.includes(a)) m.accepts.push(a);
        }
      }

      // 總啤酒數 = 有啤酒的板塊數
      m.beer = m.tiles.filter(t => t.beer > 0).length;
    }
  }

  getCurrentPlayer() {
    const pid = this.turnOrder[this.currentPlayerIndex];
    return this.players[pid];
  }

  getCurrentPlayerId() {
    return this.turnOrder[this.currentPlayerIndex];
  }

  getActionsRemaining() {
    const player = this.getCurrentPlayer();
    const maxActions = this.firstTurn ? 1 : ACTIONS_PER_TURN;
    return maxActions - player.actionsThisTurn;
  }

  addLog(msg) {
    this.log.push({ time: Date.now(), message: msg });
    if (this.log.length > 200) this.log.shift();
  }

  // Process an action from a player
  executeAction(playerId, actionType, params) {
    if (this.gameOver) {
      return { success: false, reason: '遊戲已結束' };
    }

    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, reason: '不是你的回合' };
    }

    if (this.getActionsRemaining() <= 0) {
      return { success: false, reason: '沒有剩餘的行動' };
    }

    // Build the game state object that actions use
    const gameState = {
      board: this.board,
      links: this.links,
      players: this.players,
      coalMarket: this.coalMarket,
      ironMarket: this.ironMarket,
      era: this.era,
      merchants: this.merchants,
      turnOrder: this.turnOrder
    };

    // 記錄行動前金錢（用於計算本輪花費）
    const moneyBefore = this.getCurrentPlayer().money;

    let result;
    switch (actionType) {
      case 'build':
        result = executeBuild(gameState, playerId, params);
        break;
      case 'network':
        result = executeNetwork(gameState, playerId, params);
        break;
      case 'develop':
        result = executeDevelop(gameState, playerId, params);
        break;
      case 'sell':
        result = executeSell(gameState, playerId, params);
        break;
      case 'loan':
        result = executeLoan(gameState, playerId, params);
        break;
      case 'scout':
        result = executeScout(gameState, playerId, params);
        break;
      default:
        result = { success: false, reason: '未知的行動類型' };
    }

    if (result.success) {
      // Sync market state back + log 市場變化
      const coalChanged = gameState.coalMarket !== this.coalMarket;
      const ironChanged = gameState.ironMarket !== this.ironMarket;
      const oldCoal = this.coalMarket, oldIron = this.ironMarket;
      this.coalMarket = gameState.coalMarket;
      this.ironMarket = gameState.ironMarket;
      if (coalChanged) this.addLog(`  [煤市場 ${oldCoal} → ${this.coalMarket}]`);
      if (ironChanged) this.addLog(`  [鐵市場 ${oldIron} → ${this.ironMarket}]`);

      // 同步待處理獎勵
      if (gameState._pendingBonus && gameState._pendingBonus[playerId]) {
        this.pendingBonus = this.pendingBonus || {};
        this.pendingBonus[playerId] = gameState._pendingBonus[playerId];
      }

      const player = this.getCurrentPlayer();
      player.actionsThisTurn++;
      // 追蹤本輪花費
      const spent = moneyBefore - player.money;
      if (spent > 0) player.spentThisRound += spent;
      // 詳細行動記錄（含花費/收入）
      const actionNum = player.actionsThisTurn;
      const costStr = spent > 0 ? `（花費 £${spent}）` : spent < 0 ? `（獲得 £${-spent}）` : '（免費）';
      this.addLog(`${player.name} [行動${actionNum}]：${result.message} ${costStr}`);

      // Check if turn is over（行動用完 或 手牌用完）
      if (this.getActionsRemaining() <= 0 || player.hand.length === 0) {
        this.endTurn();
      }
    }

    return result;
  }

  // 執行免費研發獎勵（玩家選擇後觸發）
  executeFreeDevelop(playerId, industryType) {
    const player = this.players[playerId];
    if (!player) return { success: false, reason: '玩家不存在' };

    // 必須有待處理的免費研發獎勵
    if (!this.pendingBonus || !this.pendingBonus[playerId]) {
      return { success: false, reason: '沒有待處理的免費研發獎勵' };
    }

    const tiles = player.tiles[industryType];
    if (!tiles || tiles.length === 0) {
      return { success: false, reason: `沒有 ${industryType} 板塊可研發` };
    }

    // 燈泡標記的板塊不能研發
    if (tiles[0].noDevelop) {
      return { success: false, reason: `${industryType} 目前最低等級有💡標記，不能研發` };
    }

    const removed = tiles.shift();
    // 清除已使用的 pendingBonus
    delete this.pendingBonus[playerId];
    this.addLog(`${player.name}：免費研發獎勵 — 移除了 ${industryType} Lv${removed.level}`);
    return { success: true };
  }

  // Pass action (use an action without doing anything - player must still discard)
  executePass(playerId, cardIndex) {
    if (this.gameOver) {
      return { success: false, reason: '遊戲已結束' };
    }
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, reason: '不是你的回合' };
    }
    if (this.getActionsRemaining() <= 0) {
      return { success: false, reason: '沒有剩餘的行動' };
    }

    const player = this.getCurrentPlayer();

    // 跳過仍然必須棄一張牌
    if (cardIndex === undefined || cardIndex === null || !player.hand[cardIndex]) {
      return { success: false, reason: '跳過時必須棄掉一張手牌' };
    }
    player.hand.splice(cardIndex, 1);

    player.actionsThisTurn++;
    this.addLog(`${player.name} [行動${player.actionsThisTurn}]：跳過（免費）`);

    if (this.getActionsRemaining() <= 0 || player.hand.length === 0) {
      this.endTurn();
    }

    return { success: true, message: 'Passed' };
  }

  endTurn() {
    const player = this.getCurrentPlayer();

    // 記錄本回合花費
    this.addLog(`${player.name} 的回合結束，本回合花費: \u00A3${player.spentThisRound}`);

    // Draw cards back to hand size
    const cardsToDraw = HAND_SIZE - player.hand.length;
    if (cardsToDraw > 0 && this.deck.length > 0) {
      const drawn = dealCards(this.deck, Math.min(cardsToDraw, this.deck.length));
      player.hand.push(...drawn);
    }

    // Move to next player (跳過手牌為空的玩家)
    this.currentPlayerIndex++;
    let skipCount = 0;
    while (this.currentPlayerIndex < this.turnOrder.length && skipCount < this.turnOrder.length) {
      const nextPlayer = this.getCurrentPlayer();
      if (nextPlayer.hand.length === 0 && this.deck.length === 0) {
        // 手牌空了且沒牌可抽，自動跳過
        this.addLog(`${nextPlayer.name} 無手牌，自動跳過`);
        this.currentPlayerIndex++;
        skipCount++;
      } else {
        break;
      }
    }

    if (this.currentPlayerIndex >= this.turnOrder.length) {
      this.endRound();
    } else {
      const nextPlayer = this.getCurrentPlayer();
      nextPlayer.actionsThisTurn = 0;
      const actionsHint = this.firstTurn ? '（首輪僅 1 個行動）' : '';
      this.addLog(`${nextPlayer.name} 的回合${actionsHint}`);
    }
  }

  endRound() {
    this.currentPlayerIndex = 0;
    this.round++;

    // Income phase
    this.addLog(`=== 第 ${this.round - 1} 輪結束 ===`);
    for (const pid of this.turnOrder) {
      const player = this.players[pid];
      const income = getIncomeLevel(player.trackPos);
      const sign = income >= 0 ? '+' : '';
      this.addLog(`${player.name}（收入等級:${income}）獲得: ${sign}${income}`);
      player.money += income;
      if (player.money < 0) player.money = 0;
    }

    // Check if all cards are played (era ends)
    const allHandsEmpty = this.turnOrder.every(pid => this.players[pid].hand.length === 0);
    const deckEmpty = this.deck.length === 0;

    if (allHandsEmpty && deckEmpty) {
      this.endEra();
      return;
    }

    // 顯示本輪花費（用於決定順序）
    const spendLog = this.turnOrder.map(pid => {
      const p = this.players[pid];
      return `${p.name}:£${p.spentThisRound || 0}`;
    }).join(' | ');
    this.addLog(`本輪花費：${spendLog}`);

    // 依花費重新排序（花最少的先行動）
    const gameState = {
      players: this.players,
      turnOrder: this.turnOrder
    };
    this.turnOrder = calculateTurnOrder(gameState);

    const orderLog = this.turnOrder.map((pid, i) => `${i + 1}.${this.players[pid].name}`).join(' → ');
    this.addLog(`新順序：${orderLog}`);

    // 重置本輪花費和行動數
    for (const pid of this.turnOrder) {
      this.players[pid].actionsThisTurn = 0;
      this.players[pid].spentThisRound = 0;
    }
    this.firstTurn = false;

    // 跳過手牌為空的玩家
    let roundSkipCount = 0;
    while (this.currentPlayerIndex < this.turnOrder.length && roundSkipCount < this.turnOrder.length) {
      const p = this.getCurrentPlayer();
      if (p.hand.length === 0 && this.deck.length === 0) {
        this.addLog(`${p.name} 無手牌，自動跳過`);
        this.currentPlayerIndex++;
        roundSkipCount++;
      } else {
        break;
      }
    }

    if (this.currentPlayerIndex >= this.turnOrder.length) {
      // 所有人都沒牌了，結束時代
      this.endEra();
      return;
    }

    this.addLog(`第 ${this.round} 輪 - ${this.getCurrentPlayer().name} 的回合`);
  }

  endEra() {
    if (this.era === ERAS.CANAL) {
      this.addLog('=== 運河時代計分 ===');

      const gameState = {
        board: this.board,
        links: this.links,
        players: this.players,
        turnOrder: this.turnOrder
      };

      const scores = scoreCanalEra(gameState);

      // 保存計分動畫數據
      this.scoringAnimation = { era: 'canal', scores };

      // Sync state back
      this.links = gameState.links;

      for (const [pid, score] of Object.entries(scores)) {
        this.addLog(`${this.players[pid].name}：路線 +${score.linkVP} 分，產業 +${score.industryVP} 分`);
      }

      // Transition to Rail Era
      this.era = ERAS.RAIL;
      this.round = 1;
      this.deck = createDeck(this.playerCount);

      // 注意：鐵路時代開始時不重置商人啤酒（官方規則：運河時代消耗的啤酒不會補充）

      for (const pid of this.turnOrder) {
        this.players[pid].hand = dealCards(this.deck, HAND_SIZE);
        this.players[pid].actionsThisTurn = 0;
      }

      // Recalculate turn order
      const orderState = { players: this.players, turnOrder: this.turnOrder };
      this.turnOrder = calculateTurnOrder(orderState);
      this.currentPlayerIndex = 0;
      this.firstTurn = false; // 鐵路時代首輪就是2行動（只有運河首輪才是1行動）

      this.addLog('=== 鐵路時代開始 ===');
      this.addLog(`${this.getCurrentPlayer().name} 的回合`);

    } else {
      // Rail era ended - final scoring
      this.addLog('=== 最終計分 ===');

      const gameState = {
        board: this.board,
        links: this.links,
        players: this.players,
        turnOrder: this.turnOrder
      };

      const { scores, winner } = scoreRailEra(gameState);

      // 保存計分動畫數據
      this.scoringAnimation = { era: 'rail', scores };

      for (const [pid, score] of Object.entries(scores)) {
        this.addLog(`${this.players[pid].name}：路線 +${score.linkVP} 分，產業 +${score.industryVP} 分 = 共 ${this.players[pid].vp} 分`);
      }

      this.gameOver = true;
      this.winner = winner;
      this.addLog(`\u{1F3C6} 贏家：${this.players[winner].name}，共 ${this.players[winner].vp} 分！`);
    }
  }

  // 建立共用狀態（所有玩家相同的部分）— 快取直到狀態變化
  getSharedState() {
    const currentPid = this.getCurrentPlayerId();
    const players = {};
    for (const [pid, player] of Object.entries(this.players)) {
      players[pid] = {
        id: player.id,
        name: player.name,
        money: player.money,
        trackPos: player.trackPos,
        incomeLevel: getIncomeLevel(player.trackPos),
        income: getIncomeLevel(player.trackPos),
        vp: player.vp,
        handSize: player.hand.length,
        tiles: player.tiles,
        actionsThisTurn: player.actionsThisTurn,
        spentThisRound: player.spentThisRound || 0,
        isCurrentPlayer: pid === currentPid
      };
    }

    return {
      era: this.era,
      round: this.round,
      currentPlayerId: currentPid,
      actionsRemaining: this.getActionsRemaining(),
      turnOrder: this.turnOrder,
      gameOver: this.gameOver,
      winner: this.winner,
      board: this.board,
      links: this.links,
      coalMarket: this.coalMarket,
      ironMarket: this.ironMarket,
      merchants: this.merchants,
      deckCount: this.deck.length,
      scoringAnimation: this.scoringAnimation || null,
      log: this.log.slice(-50),
      players
    };
  }

  // Get sanitized state for a specific player (hide other hands)
  getStateForPlayer(playerId, sharedState) {
    const base = sharedState || this.getSharedState();
    // 計算玩家連通網路（供前端直接使用，避免前後端重複實作 BFS）
    const gameState = {
      board: this.board,
      links: this.links,
      players: this.players,
      coalMarket: this.coalMarket,
      ironMarket: this.ironMarket,
      era: this.era,
      merchants: this.merchants,
      turnOrder: this.turnOrder
    };
    const network = getPlayerNetwork(gameState, playerId);
    return {
      ...base,
      pendingBonus: (this.pendingBonus && this.pendingBonus[playerId]) || null,
      myHand: this.players[playerId] ? this.players[playerId].hand : [],
      myNetwork: Array.from(network)
    };
  }
}

module.exports = BrassGame;
