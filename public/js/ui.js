// UI 管理 - 工業革命：伯明翰（全中文版）

// HTML 轉義（防 XSS）
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

class GameUI {
  constructor() {
    this.selectedCardIndex = -1;
    this.selectedAction = null;
    this.actionState = {};
    this.gameState = null;
    this.myPlayerId = null;
  }

  updateGameState(state, myPlayerId) {
    this.gameState = state;
    this.myPlayerId = myPlayerId;
    this.updateTopBar(state);
    this.updatePlayerPanels(state, myPlayerId);
    this.updateMyTiles(state, myPlayerId);
    this.updateIncomeTrack(state, myPlayerId);
    this.updateHand(state);
    this.updateActionButtons(state, myPlayerId);
    this.updateMerchants(state);
    this.updateLog(state);
    if (state.gameOver) {
      if (!this._gameOverShown) {
        this._gameOverShown = true;
        this.showGameOver(state);
      }
    } else {
      // 遊戲重新開始（例如房間複用）時重置旗標
      this._gameOverShown = false;
    }
  }

  /* ─── 頂部資訊列 ─── */
  updateTopBar(state) {
    const badge = document.getElementById('era-badge');
    badge.className = state.era;
    document.getElementById('era-icon').textContent = state.era === 'canal' ? '\u2693' : '\u26DE';
    document.getElementById('era-text').textContent = state.era === 'canal' ? '運河時代' : '鐵路時代';

    const isMyTurn = state.currentPlayerId === this.myPlayerId;
    const cur = state.players[state.currentPlayerId];
    const curIdx = cur ? state.turnOrder.indexOf(state.currentPlayerId) : 0;
    const curColor = PLAYER_COLORS[curIdx] || '#fff';
    const td = document.getElementById('turn-display');
    td.className = isMyTurn ? 'my-turn' : 'waiting';
    if (isMyTurn) {
      td.innerHTML = `✨ 你的回合（剩餘 <b>${state.actionsRemaining}</b> 個行動）`;
    } else {
      td.innerHTML = `⏳ <span style="color:${curColor};font-weight:600">${escHtml(cur ? cur.name : '?')}</span> 的回合`;
    }

    document.getElementById('coal-market').textContent = `${state.coalMarket}/${COAL_MARKET_SIZE}`;
    document.getElementById('iron-market').textContent = `${state.ironMarket}/${IRON_MARKET_SIZE}`;

    const cp = state.coalMarket > 0 ? getCoalBuyPrice(state.coalMarket) : '--';
    const ip = state.ironMarket > 0 ? getIronBuyPrice(state.ironMarket) : '--';
    document.getElementById('coal-price').textContent = `\u00A3${cp}`;
    document.getElementById('iron-price').textContent = `\u00A3${ip}`;

    const deckEl = document.getElementById('deck-count');
    if (deckEl) deckEl.textContent = state.deckCount !== undefined ? state.deckCount : '?';
  }

  /* ─── 玩家面板（差量更新）─── */
  updatePlayerPanels(state, myPlayerId) {
    const c = document.getElementById('player-panels');
    const existing = c.children;

    state.turnOrder.forEach((pid, idx) => {
      const p = state.players[pid];
      const col = PLAYER_COLORS[idx];
      let panel = existing[idx];

      if (!panel || panel.dataset.pid !== pid) {
        // 結構變了（玩家順序改變），全量重建此面板
        panel = document.createElement('div');
        panel.className = 'player-panel';
        panel.dataset.pid = pid;
        panel.innerHTML = `
          <div class="pp-header">
            <div class="pp-dot" style="background:${col}"></div>
            <div class="pp-name" style="color:${col}">${escHtml(p.name)}</div>
            ${pid === myPlayerId ? '<div class="pp-me">自己</div>' : ''}
          </div>
          <div class="pp-stats">
            <div class="pp-stat">\u00A3 <span class="val" data-f="money"></span></div>
            <div class="pp-stat">\u2605 <span class="val" data-f="vp"></span></div>
            <div class="pp-stat">\u2191 <span class="val" data-f="income"></span></div>
            <div class="pp-stat">\u2663 <span class="val" data-f="hand"></span></div>
            <div class="pp-stat">\u{1F4B8} <span class="val" data-f="spent"></span></div>
          </div>
        `;
        if (existing[idx]) c.replaceChild(panel, existing[idx]);
        else c.appendChild(panel);
      }

      // 差量更新 class
      panel.classList.toggle('current-turn', !!p.isCurrentPlayer);
      panel.classList.toggle('is-me', pid === myPlayerId);

      // 差量更新數值
      const setVal = (field, text, style) => {
        const el = panel.querySelector(`[data-f="${field}"]`);
        if (el) { el.textContent = text; if (style !== undefined) el.style.color = style; }
      };
      setVal('money', p.money);
      setVal('vp', p.vp + ' 分');
      setVal('income', '\u00A3' + p.income + '/輪');
      setVal('hand', p.handSize + ' 張牌');
      setVal('spent', '本輪花費 ' + p.spentThisRound, p.spentThisRound > 0 ? '#f88' : 'var(--text-dim)');
    });

    // 移除多餘面板
    while (c.children.length > state.turnOrder.length) {
      c.removeChild(c.lastChild);
    }
  }

  /* ─── 我的產業板塊（Steam 風格面板，差量更新）─── */
  updateMyTiles(state, myPlayerId) {
    const c = document.getElementById('my-tiles-content');
    if (!c) return;

    // 快速指紋：每種產業的數量+最低等級，變化時才重建
    const me = state.players[myPlayerId];
    if (!me) { c.innerHTML = ''; return; }
    const fp = JSON.stringify(Object.entries(me.tiles).map(([t, arr]) => [t, arr.length, arr[0]?.level]));
    if (c.dataset.fp === fp) return; // 沒變，跳過
    c.dataset.fp = fp;
    c.innerHTML = '';

    const era = state.era;
    const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII'];
    const typeOrder = ['cotton', 'coal', 'iron', 'manufacturer', 'pottery', 'brewery'];

    for (const type of typeOrder) {
      const tiles = me.tiles[type] || [];
      const d = INDUSTRY_DISPLAY[type];

      // 產業行
      const row = document.createElement('div');
      row.className = 'ind-row';

      // 產業標題
      const header = document.createElement('div');
      header.className = 'ind-header';
      header.style.borderLeftColor = d.iconBg;
      header.innerHTML = `<span style="color:${d.iconBg}">${d.label}</span> <span class="ind-count">${tiles.length}</span>`;
      row.appendChild(header);

      // 板塊網格
      const grid = document.createElement('div');
      grid.className = 'ind-grid';

      // 按等級分組
      const byLevel = {};
      for (const t of tiles) {
        if (!byLevel[t.level]) byLevel[t.level] = [];
        byLevel[t.level].push(t);
      }

      for (const [lv, lvTiles] of Object.entries(byLevel)) {
        const t = lvTiles[0];
        const eraLocked = (t.era === 'canal' && era !== 'canal') || (t.era === 'rail' && era !== 'rail');
        const noDev = t.noDevelop;

        for (let idx = 0; idx < lvTiles.length; idx++) {
          const tile = document.createElement('div');
          tile.className = `ind-tile ${eraLocked ? 'locked' : ''}`;
          tile.style.borderTopColor = d.iconBg;

          // 等級（羅馬數字）
          const lvNum = ROMAN[t.level] || t.level;

          // 費用圖標
          let costIcons = '';
          if (t.coalCost > 0) costIcons += `<span class="res-icon coal">${t.coalCost}</span>`;
          if (t.ironCost > 0) costIcons += `<span class="res-icon iron">${t.ironCost}</span>`;

          // 資源/啤酒
          let prodText = '';
          if (t.resourceAmount > 0) {
            const rn = type === 'coal' ? '⬛' : type === 'iron' ? '🟠' : '🍺';
            prodText = `${rn}${t.resourceAmount}`;
          }
          if (t.sellBeer > 0) prodText = `🍺${t.sellBeer}`;

          // 背景圖片
          const imgFile = `/img/cards/industry-${type}.png`;
          tile.innerHTML = `
            <div class="it-bg" style="background-image:url('${imgFile}')"></div>
            <div class="it-content">
              <div class="it-level">${lvNum}</div>
              <div class="it-cost">£${t.cost} ${costIcons}</div>
              <div class="it-stats">
                <span class="it-vp">${t.vp}★</span>
                <span class="it-inc">+${t.income}</span>
              </div>
              ${prodText ? `<div class="it-prod">${prodText}</div>` : ''}
              ${noDev ? '<div class="it-nodev">💡</div>' : ''}
              ${eraLocked ? '<div class="it-era">🚂</div>' : ''}
            </div>
          `;

          tile.title = `${d.label} ${lvNum}\n費用: £${t.cost}${t.coalCost?' +煤×'+t.coalCost:''}${t.ironCost?' +鐵×'+t.ironCost:''}\n分數: ${t.vp} VP | 收入: +${t.income}格${t.resourceAmount ? '\n產出: '+t.resourceAmount : ''}${t.sellBeer ? '\n販賣需啤酒×'+t.sellBeer : ''}${noDev?'\n💡不能研發':''}${eraLocked?'\n🚂鐵路時代限定':''}`;

          grid.appendChild(tile);
        }
      }

      if (tiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ind-empty';
        empty.textContent = '全部用完';
        grid.appendChild(empty);
      }

      row.appendChild(grid);
      c.appendChild(row);
    }
  }

  /* ─── 收入軌道 ─── */
  updateIncomeTrack(state, myPlayerId) {
    const c = document.getElementById('income-track-content');
    if (!c) return;
    c.innerHTML = '';

    const me = state.players[myPlayerId];
    if (!me) return;

    const myLevel = me.incomeLevel; // 實際收入金額
    const myPos = me.trackPos;     // 軌道位置

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'margin-bottom:6px;font-size:.95em;line-height:1.6';
    infoDiv.innerHTML =
      `收入等級 <b style="color:var(--gold)">${myLevel}</b>` +
      ` = 每回合 <b style="color:${myLevel >= 0 ? 'var(--green)' : 'var(--accent)'}">\u00A3${myLevel}</b>` +
      `<br><span style="color:var(--text-dim);font-size:.85em">軌道格 ${myPos}  |  借貸降收入3=→£${Math.max(myLevel-3, -10)}</span>`;
    c.appendChild(infoDiv);

    // 軌道：按等級顯示（每級不同寬度代表格數）
    const trackDiv = document.createElement('div');
    trackDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:1px';

    // 收集玩家位置（按等級）
    const playerAtLevel = {};
    for (const pid of state.turnOrder) {
      const lv = state.players[pid].incomeLevel;
      if (!playerAtLevel[lv]) playerAtLevel[lv] = [];
      playerAtLevel[lv].push(state.turnOrder.indexOf(pid));
    }

    for (let val = -10; val <= 30; val++) {
      // 每級的格數
      const spacesPerLevel = val <= 0 ? 1 : val <= 10 ? 2 : val <= 20 ? 3 : val <= 29 ? 4 : 3;
      const cell = document.createElement('div');
      cell.className = 'it-cell';
      // 寬度按格數比例
      cell.style.width = (spacesPerLevel * 6 + 14) + 'px';
      cell.style.minWidth = cell.style.width;

      if (val === myLevel) cell.classList.add('current');
      if (val < 0) cell.classList.add('negative');

      if (playerAtLevel[val]) {
        const dots = playerAtLevel[val].map(idx =>
          `<span style="color:${PLAYER_COLORS[idx]};">\u25CF</span>`
        ).join('');
        cell.innerHTML = `<span style="font-size:6px">${val}</span>${dots}`;
      } else {
        cell.textContent = val;
      }
      cell.title = `£${val}/輪（${spacesPerLevel}格寬）`;
      trackDiv.appendChild(cell);
    }
    c.appendChild(trackDiv);
  }

  /* ─── 手牌 ─── */
  updateHand(state) {
    const c = document.getElementById('hand-cards');
    c.innerHTML = '';
    document.getElementById('hand-count').textContent = state.myHand.length;

    state.myHand.forEach((card, i) => {
      const el = document.createElement('div');
      el.className = `card ${card.type}`;
      if (i === this.selectedCardIndex) el.classList.add('selected');

      let typeLabel, nameLabel, detailLabel = '';
      let cardImgFile = null;

      if (card.type === 'location') {
        typeLabel = '地點牌';
        nameLabel = card.name;
        detailLabel = '在此城市建造';
        cardImgFile = `location-${card.location}.png`;
      } else if (card.type === 'industry') {
        typeLabel = '產業牌';
        const d = INDUSTRY_DISPLAY[card.industry];
        nameLabel = d ? `${d.label}` : card.name;
        detailLabel = '在網路上任意處建造';
        cardImgFile = `industry-${card.industry}.png`;
      } else if (card.type === 'wild_location') {
        typeLabel = '萬能牌';
        nameLabel = '任意地點';
        detailLabel = '可在任何城市建造';
        cardImgFile = 'wild-location.png';
      } else if (card.type === 'wild_industry') {
        typeLabel = '萬能牌';
        nameLabel = '任意產業';
        detailLabel = '可建造任何類型';
        cardImgFile = 'wild-industry.png';
      } else {
        typeLabel = card.type;
        nameLabel = card.name;
      }

      // 檢查圖片是否存在（用快取避免重複檢查）
      if (!window._cardImgCache) window._cardImgCache = {};
      const imgPath = cardImgFile ? `/img/cards/${cardImgFile}` : null;
      const hasImg = imgPath && (window._cardImgCache[imgPath] !== false);

      if (hasImg && imgPath) {
        // 有圖片時用圖片背景
        if (window._cardImgCache[imgPath] === undefined) {
          // 第一次：非同步確認圖片是否存在，載入後用最新狀態重繪
          const testImg = new Image();
          const self = this;
          testImg.onload = () => { window._cardImgCache[imgPath] = true; if (self.gameState) self.updateHand(self.gameState); };
          testImg.onerror = () => { window._cardImgCache[imgPath] = false; };
          testImg.src = imgPath;
        }
        el.innerHTML = `
          <div class="card-img" style="background-image:url('${imgPath}')"></div>
          <div class="card-overlay">
            <div class="card-type">${typeLabel}</div>
            <div class="card-name">${nameLabel}</div>
          </div>
        `;
      } else {
        // 沒圖片時用原本的文字卡片
        el.innerHTML = `
          <div class="card-type">${typeLabel}</div>
          <div class="card-name">${nameLabel}</div>
          <div class="card-detail">${detailLabel}</div>
        `;
      }

      el.addEventListener('click', () => {
        this.selectedCardIndex = this.selectedCardIndex === i ? -1 : i;
        this.updateHand(state);
      });

      // hover 時在地圖上高亮對應城市
      el.addEventListener('mouseenter', () => {
        if (!window.renderer) return;
        const r = window.renderer;
        r.highlightedCities = [];  // 綠色=可建造
        r.dimHighlightedCities = []; // 暗色=有格但不能蓋

        if (card.type === 'location' && card.location && card.location !== 'wild') {
          // 地點牌：只高亮該城市（用地點牌不需要網路）
          r.highlightedCities = [card.location];
        } else if (card.type === 'industry' && card.industry) {
          // 產業牌：需要在自己網路上 + 有空的對應格
          // 使用 server 已計算好的 myNetwork，避免前後端重複實作 BFS
          if (state && state.board) {
            const myNetwork = new Set(state.myNetwork || []);
            const hasPresence = myNetwork.size > 0;

            for (const [cid, loc] of Object.entries(state.board)) {
              let hasMatchingSlot = false;
              for (const slot of loc.slots) {
                if (!slot.built && slot.types && slot.types.includes(card.industry)) {
                  hasMatchingSlot = true; break;
                }
              }
              if (hasMatchingSlot) {
                if (!hasPresence || myNetwork.has(cid)) {
                  r.highlightedCities.push(cid);  // 綠色：可以蓋
                } else {
                  r.dimHighlightedCities.push(cid); // 暗色：有格但不在網路上
                }
              }
            }
          }
        } else if (card.type === 'wild_location') {
          // 萬能地點：所有有空格的城市
          if (state && state.board) {
            for (const [cid, loc] of Object.entries(state.board)) {
              if (loc.slots.some(s => !s.built)) r.highlightedCities.push(cid);
            }
          }
        }
        if (state) r.scheduleRender(state);
      });
      el.addEventListener('mouseleave', () => {
        if (window.renderer) {
          window.renderer.highlightedCities = [];
          window.renderer.dimHighlightedCities = [];
          if (state) window.renderer.scheduleRender(state);
        }
      });

      c.appendChild(el);
    });
  }

  /* ─── 行動按鈕 ─── */
  updateActionButtons(state, myPlayerId) {
    const isMyTurn = state.currentPlayerId === myPlayerId && !state.gameOver;
    const hasCard = this.selectedCardIndex >= 0;
    document.querySelectorAll('.action-btn').forEach(b => {
      b.disabled = !isMyTurn;
      b.classList.remove('selected', 'needs-card');
      if (isMyTurn && !hasCard) b.classList.add('needs-card');
    });
    if (this.selectedAction) {
      const b = document.querySelector(`[data-action="${this.selectedAction}"]`);
      if (b) { b.classList.add('selected'); b.classList.remove('needs-card'); }
    }
  }

  /* ─── 商人面板 ─── */
  updateMerchants(state) {
    const c = document.getElementById('merchant-content');
    if (!c || !state.merchants) return;
    const TYPE_LABELS = { cotton: '棉花', manufacturer: '工廠', pottery: '陶瓷' };
    const BONUS_LABELS = { vp: 'VP', money: '金錢', free_develop: '免費研發', free_road: '免費建路' };
    let html = '';
    for (const m of state.merchants) {
      if (!m.active) continue;
      const usedTiles = (m.tiles || []).filter(t => t.used).length;
      const totalTiles = (m.tiles || []).length;
      const allUsed = usedTiles >= totalTiles;
      const accepts = (m.tiles || []).filter(t => !t.used)
        .map(t => t.accepts.map(a => TYPE_LABELS[a] || a).join('/'))
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const bonusDesc = m.bonusType
        ? `${BONUS_LABELS[m.bonusType] || m.bonusType}${m.bonusAmount ? ' +' + m.bonusAmount : ''}`
        : '';
      html += `<div class="merchant-item${allUsed ? ' exhausted' : ''}">
        <div class="mi-header">
          <span class="mi-name">${escHtml(m.name)}</span>
          <span class="mi-slots">${totalTiles - usedTiles}/${totalTiles}</span>
        </div>
        <div class="mi-detail">
          ${m.beer > 0 ? `<span class="mi-beer">🍺×${m.beer}</span>` : ''}
          ${accepts.length ? `<span class="mi-accepts">${accepts.join('、')}</span>` : ''}
          ${bonusDesc ? `<span class="mi-bonus">✨${bonusDesc}</span>` : ''}
        </div>
      </div>`;
    }
    c.innerHTML = html || '<span style="color:var(--text-dim);font-size:.85em">無商人資訊</span>';
  }

  /* ─── 遊戲記錄（差量追加）─── */
  updateLog(state) {
    const c = document.getElementById('log-content');
    const existingCount = c.children.length;
    const logEntries = state.log;

    const makeEntry = (e) => {
      const d = document.createElement('div');
      d.className = 'log-entry';
      const msg = e.message;
      if (msg.startsWith('===')) d.classList.add('highlight');
      else if (msg.includes('建造') || msg.includes('建路')) d.classList.add('log-build');
      else if (msg.includes('販賣') || msg.includes('賣到市場')) d.classList.add('log-sell');
      else if (msg.includes('貸款')) d.classList.add('log-loan');
      else if (msg.includes('研發')) d.classList.add('log-develop');
      else if (msg.includes('計分') || msg.includes('VP') || msg.includes('分')) d.classList.add('log-score');
      else if (msg.includes('收入') || msg.includes('獲得')) d.classList.add('log-income');
      d.textContent = msg;
      return d;
    };

    if (existingCount > logEntries.length) {
      c.innerHTML = '';
      for (const e of logEntries) c.appendChild(makeEntry(e));
    } else {
      for (let i = existingCount; i < logEntries.length; i++) c.appendChild(makeEntry(logEntries[i]));
    }

    if (existingCount < logEntries.length) {
      c.scrollTop = c.scrollHeight;
    }
  }

  /* ─── 遊戲結束 ─── */
  showGameOver(state) {
    document.getElementById('game-over-overlay').style.display = 'flex';
    const sc = document.getElementById('final-scores');
    sc.innerHTML = '';
    const sorted = state.turnOrder.map(pid => state.players[pid]).sort((a, b) => b.vp - a.vp);
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'final-score-row';
      if (p.id === state.winner) row.classList.add('winner');
      row.innerHTML = `
        <span class="rank">${i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : ''}</span>
        <span>${escHtml(p.name)}</span>
        <span>${p.vp} 分 &nbsp;\u00A3${p.money}</span>
      `;
      sc.appendChild(row);
    });
  }

  /* ─── 選擇彈窗 ─── */
  showSelection(title, options, callback) {
    const ov = document.getElementById('selection-overlay');
    ov.style.display = 'flex';
    document.getElementById('selection-title').textContent = title;
    const od = document.getElementById('selection-options');
    od.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('div');
      b.className = 'selection-option';
      b.textContent = o.label;
      b.addEventListener('click', () => { ov.style.display = 'none'; callback(o.value); });
      od.appendChild(b);
    }
    document.getElementById('btn-close-selection').onclick = () => { ov.style.display = 'none'; this.cancelAction(); };
  }

  showActionDetail(title, content) {
    const p = document.getElementById('action-detail');
    p.style.display = 'block';
    document.getElementById('action-detail-title').textContent = title;
    document.getElementById('action-detail-content').innerHTML = content;
  }
  hideActionDetail() { document.getElementById('action-detail').style.display = 'none'; }

  cancelAction() {
    this.selectedAction = null;
    this.actionState = {};
    this.hideActionDetail();
    if (this.gameState) this.updateActionButtons(this.gameState, this.myPlayerId);
  }

  showError(msg) { this._toast(msg, 'error'); }
  showInfo(msg) { this._toast(msg, 'info'); }

  _toast(msg, type) {
    const old = document.querySelector('.toast-msg');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = `toast-msg ${type}`;
    t.textContent = msg;
    // a11y: errors are assertive (interrupts SR), info is polite
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}
