#!/usr/bin/env node
// 4個 AI 玩家連進遊戲伺服器自動對戰
// 用法: node test-ai-players.js [port]

const io = require('socket.io-client');
const PORT = process.argv[2] || 3000;
const URL = `http://localhost:${PORT}`;

const AI_NAMES = ['AI-Alice', 'AI-Bob', 'AI-Carol', 'AI-Dave'];
const players = [];

console.log('🤖 啟動 4 個 AI 玩家連接到', URL);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class AIPlayer {
  constructor(name, index) {
    this.name = name;
    this.index = index;
    this.socket = io(URL);
    this.playerId = null;
    this.roomId = null;
    this.state = null;
    this.actionCount = 0;

    this.socket.on('connect', () => {
      console.log(`  ${name} 已連接 (${this.socket.id})`);
    });

    this.socket.on('room-created', ({ roomId, playerId }) => {
      this.playerId = playerId;
      this.roomId = roomId;
      console.log(`  ${name} 建立房間 ${roomId}`);
    });

    this.socket.on('room-joined', ({ roomId, playerId }) => {
      this.playerId = playerId;
      this.roomId = roomId;
      console.log(`  ${name} 加入房間 ${roomId}`);
    });

    this.socket.on('room-update', (data) => {
      // 自動準備
      if (data && data.players) {
        const me = data.players.find(p => p.id === this.playerId);
        if (me && !me.ready) {
          this.socket.emit('toggle-ready');
        }
      }
    });

    this.socket.on('game-state', (state) => {
      this.state = state;
      if (state.currentPlayerId === this.playerId && !state.gameOver) {
        setTimeout(() => this.think(), 500);
      }
      if (state.gameOver && this.index === 0) {
        this.printResults(state);
      }
    });

    this.socket.on('action-error', (msg) => {
      // 靜默處理，嘗試 pass
      if (this.state && this.state.currentPlayerId === this.playerId) {
        this.socket.emit('pass-action', { cardIndex: 0 });
      }
    });

    this.socket.on('reconnect-success', ({ playerId }) => {
      this.playerId = playerId;
    });
  }

  think() {
    const s = this.state;
    if (!s || s.gameOver) return;
    const me = s.players[this.playerId];
    if (!me || me.handSize === 0) return;

    this.actionCount++;
    const era = s.era;
    const isCanal = era === 'canal';

    // 簡易 AI 策略
    // 1. 嘗試建路到商人
    // 2. 嘗試販賣
    // 3. 嘗試建造
    // 4. 嘗試研發
    // 5. 嘗試貸款
    // 6. Pass

    // 優先建路（隨機選一條可建的）
    if (me.money >= (isCanal ? 3 : 5)) {
      const conns = this.getAvailableLinks();
      if (conns.length > 0) {
        const pick = conns[Math.floor(Math.random() * conns.length)];
        this.socket.emit('game-action', {
          actionType: 'network',
          params: { cardIndex: 0, links: [{ from: pick.from, to: pick.to }] }
        });
        return;
      }
    }

    // 嘗試販賣
    for (const [cid, loc] of Object.entries(s.board)) {
      for (let si = 0; si < loc.slots.length; si++) {
        const slot = loc.slots[si];
        if (slot.built && slot.built.owner === this.playerId && !slot.built.flipped) {
          if (['cotton', 'manufacturer', 'pottery'].includes(slot.built.type)) {
            this.socket.emit('game-action', {
              actionType: 'sell',
              params: { cardIndex: 0, sales: [{ locationId: cid, slotIndex: si }] }
            });
            return;
          }
        }
      }
    }

    // 嘗試建造
    const hand = s.myHand;
    if (hand.length > 0) {
      const card = hand[0];
      if (card.type === 'location' && s.board[card.location]) {
        const loc = s.board[card.location];
        for (let si = 0; si < loc.slots.length; si++) {
          if (!loc.slots[si].built) {
            const indType = loc.slots[si].types[0];
            this.socket.emit('game-action', {
              actionType: 'build',
              params: { cardIndex: 0, locationId: card.location, slotIndex: si, industryType: indType }
            });
            return;
          }
        }
      }

      if (card.type === 'industry') {
        for (const [cid, loc] of Object.entries(s.board)) {
          if (loc.isMerchant) continue;
          for (let si = 0; si < loc.slots.length; si++) {
            if (!loc.slots[si].built && loc.slots[si].types.includes(card.industry)) {
              this.socket.emit('game-action', {
                actionType: 'build',
                params: { cardIndex: 0, locationId: cid, slotIndex: si, industryType: card.industry }
              });
              return;
            }
          }
        }
      }
    }

    // 貸款
    if (me.money < 8 && me.incomeLevel > -7) {
      this.socket.emit('game-action', {
        actionType: 'loan',
        params: { cardIndex: 0 }
      });
      return;
    }

    // 研發
    for (const [type, tiles] of Object.entries(me.tiles)) {
      if (tiles.length > 0 && !tiles[0].noDevelop) {
        this.socket.emit('game-action', {
          actionType: 'develop',
          params: { cardIndex: 0, industryTypes: [type] }
        });
        return;
      }
    }

    // Pass
    this.socket.emit('pass-action', { cardIndex: 0 });
  }

  getAvailableLinks() {
    // 簡易：回傳所有可能的連線（不嚴格檢查）
    const s = this.state;
    const isCanal = s.era === 'canal';
    const results = [];

    // 從 boardData 取得連線（但我們在伺服器端，所以用簡化版）
    const knownConns = [
      ['birmingham','merchant-oxford'], ['birmingham','coventry'],
      ['birmingham','walsall'], ['birmingham','tamworth'],
      ['birmingham','dudley'], ['birmingham','worcester'],
      ['wolverhampton','coalbrookdale'], ['wolverhampton','dudley'],
      ['wolverhampton','walsall'], ['wolverhampton','cannock'],
      ['dudley','kidderminster'], ['kidderminster','worcester'],
      ['kidderminster','coalbrookdale'], ['cannock','walsall'],
      ['cannock','stafford'], ['tamworth','nuneaton'],
      ['tamworth','burton'], ['burton','stone'],['burton','derby'],
      ['stafford','stone'], ['stone','stoke-on-trent'],
      ['stoke-on-trent','leek'], ['derby','belper'],
      ['coalbrookdale','merchant-shrewsbury'],
      ['worcester','merchant-gloucester'],
      ['stoke-on-trent','merchant-warrington'],
      ['derby','merchant-nottingham'],
      ['cannock','farm-brewery-cannock'],
    ];

    for (const [from, to] of knownConns) {
      const exists = s.links.some(l =>
        (l.from === from && l.to === to) || (l.from === to && l.to === from)
      );
      if (!exists) results.push({ from, to });
    }
    return results;
  }

  printResults(state) {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║        🎮 遊戲結束！              ║');
    console.log('╚══════════════════════════════════╝\n');

    const sorted = state.turnOrder.map(pid => state.players[pid]).sort((a, b) => b.vp - a.vp);
    console.log('┌──────────┬──────┬──────┬──────┐');
    console.log('│ 玩家     │  VP  │ 金錢 │ 收入 │');
    console.log('├──────────┼──────┼──────┼──────┤');
    sorted.forEach(p => {
      const t = p.id === state.winner ? ' 🏆' : '';
      console.log('│ ' + (p.name + t).padEnd(9) + '│' +
        String(p.vp).padStart(5) + ' │' +
        ('£' + p.money).padStart(5) + ' │' +
        ('£' + p.income).padStart(5) + ' │');
    });
    console.log('└──────────┴──────┴──────┴──────┘');

    console.log('\n總行動數:', players.reduce((s, p) => s + p.actionCount, 0));
    console.log('\n3秒後退出...');
    setTimeout(() => process.exit(0), 3000);
  }
}

async function main() {
  // 第一個 AI 建立房間
  const host = new AIPlayer(AI_NAMES[0], 0);
  players.push(host);
  await sleep(1000);

  host.socket.emit('create-room', { name: AI_NAMES[0] });
  await sleep(1000);

  // 其他 AI 加入
  for (let i = 1; i < 4; i++) {
    const ai = new AIPlayer(AI_NAMES[i], i);
    players.push(ai);
    await sleep(500);
    ai.socket.emit('join-room', { roomId: host.roomId, name: AI_NAMES[i] });
    await sleep(500);
  }

  // 等所有人準備好
  await sleep(2000);

  // 開始遊戲
  console.log('\n🎲 開始遊戲！\n');
  host.socket.emit('start-game');
}

main().catch(console.error);
