// UI 管理 - 工業革命：伯明翰（全中文版）

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
    this.updateLog(state);
    if (state.gameOver) this.showGameOver(state);
  }

  /* ─── 頂部資訊列 ─── */
  updateTopBar(state) {
    const badge = document.getElementById('era-badge');
    badge.className = state.era;
    document.getElementById('era-icon').textContent = state.era === 'canal' ? '\u2693' : '\u26DE';
    document.getElementById('era-text').textContent = state.era === 'canal' ? '運河時代' : '鐵路時代';

    const isMyTurn = state.currentPlayerId === this.myPlayerId;
    const cur = state.players[state.currentPlayerId];
    const td = document.getElementById('turn-display');
    td.className = isMyTurn ? 'my-turn' : 'waiting';
    td.textContent = isMyTurn
      ? `\u2728 你的回合（剩餘 ${state.actionsRemaining} 個行動）`
      : `\u23F3 ${cur ? cur.name : '?'} 的回合`;

    document.getElementById('coal-market').textContent = `${state.coalMarket}/${COAL_MARKET_SIZE}`;
    document.getElementById('iron-market').textContent = `${state.ironMarket}/${IRON_MARKET_SIZE}`;

    const cp = state.coalMarket > 0 ? getCoalBuyPrice(state.coalMarket) : '--';
    const ip = state.ironMarket > 0 ? getIronBuyPrice(state.ironMarket) : '--';
    document.getElementById('coal-price').textContent = `\u00A3${cp}`;
    document.getElementById('iron-price').textContent = `\u00A3${ip}`;

    const deckEl = document.getElementById('deck-count');
    if (deckEl) deckEl.textContent = state.deckCount !== undefined ? state.deckCount : '?';
  }

  /* ─── 玩家面板 ─── */
  updatePlayerPanels(state, myPlayerId) {
    const c = document.getElementById('player-panels');
    c.innerHTML = '';

    state.turnOrder.forEach((pid, idx) => {
      const p = state.players[pid];
      const col = PLAYER_COLORS[idx];
      const panel = document.createElement('div');
      panel.className = 'player-panel';
      if (p.isCurrentPlayer) panel.classList.add('current-turn');
      if (pid === myPlayerId) panel.classList.add('is-me');

      panel.innerHTML = `
        <div class="pp-header">
          <div class="pp-dot" style="background:${col}"></div>
          <div class="pp-name" style="color:${col}">${p.name}</div>
          ${pid === myPlayerId ? '<div class="pp-me">自己</div>' : ''}
        </div>
        <div class="pp-stats">
          <div class="pp-stat">\u00A3 <span class="val">${p.money}</span></div>
          <div class="pp-stat">\u2605 <span class="val">${p.vp} 分</span></div>
          <div class="pp-stat">\u2191 <span class="val">\u00A3${p.income}/輪</span></div>
          <div class="pp-stat">\u2663 <span class="val">${p.handSize} 張牌</span></div>
          <div class="pp-stat">\u{1F4B8} <span class="val" style="color:${p.spentThisRound > 0 ? '#f88' : 'var(--text-dim)'}">本輪花費 ${p.spentThisRound}</span></div>
        </div>
      `;
      c.appendChild(panel);
    });
  }

  /* ─── 我的產業板塊 ─── */
  updateMyTiles(state, myPlayerId) {
    const c = document.getElementById('my-tiles-content');
    if (!c) return;
    c.innerHTML = '';

    const me = state.players[myPlayerId];
    if (!me) return;

    const typeOrder = ['cotton', 'coal', 'iron', 'manufacturer', 'pottery', 'brewery'];
    const era = state.era;

    for (const type of typeOrder) {
      const tiles = me.tiles[type] || [];
      const d = INDUSTRY_DISPLAY[type];

      const row = document.createElement('div');
      row.className = 'tile-row';

      // Label
      const label = document.createElement('div');
      label.className = 'tile-row-label';
      label.style.background = d.iconBg;
      label.style.color = d.textColor;
      label.textContent = d.short;
      row.appendChild(label);

      // Tile chips
      const levelsDiv = document.createElement('div');
      levelsDiv.className = 'tile-row-levels';

      if (tiles.length === 0) {
        const empty = document.createElement('span');
        empty.style.cssText = 'font-size:.8em;color:var(--text-dim);padding:2px';
        empty.textContent = '（無）';
        levelsDiv.appendChild(empty);
      } else {
        // Group by level
        const byLevel = {};
        for (const t of tiles) {
          if (!byLevel[t.level]) byLevel[t.level] = { tile: t, count: 0 };
          byLevel[t.level].count++;
        }

        for (const [lv, info] of Object.entries(byLevel)) {
          const t = info.tile;
          const chip = document.createElement('div');
          const eraLocked = (era === 'canal' && t.eraMin === 'rail');
          chip.className = `tile-chip ${eraLocked ? 'era-locked' : 'available'}`;
          chip.title = this._tileSummary(t, d);

          // Level + count
          let lvText = `Lv${lv}`;
          if (info.count > 1) lvText += `\u00D7${info.count}`;

          // Cost summary
          let costText = `\u00A3${t.cost}`;
          if (t.coalCost > 0) costText += ` ${t.coalCost}煤`;
          if (t.ironCost > 0) costText += ` ${t.ironCost}鐵`;

          // VP/income
          let resText = `${t.vp}分 +${t.income}收`;
          if (t.resourceAmount > 0) {
            const rn = type === 'coal' ? '煤' : type === 'iron' ? '鐵' : '酒';
            resText += ` ${t.resourceAmount}${rn}`;
          }
          if (t.sellBeer > 0) resText += ` 需${t.sellBeer}酒`;

          chip.innerHTML = `
            <span class="tc-lv">${lvText}</span>
            <span class="tc-cost">${costText}</span>
            <span class="tc-res">${resText}</span>
          `;

          if (eraLocked) {
            chip.innerHTML += '<span style="font-size:.7em;color:rgba(255,80,80,.5)">鐵路限定</span>';
          }

          levelsDiv.appendChild(chip);
        }
      }

      row.appendChild(levelsDiv);
      c.appendChild(row);
    }
  }

  _tileSummary(t, d) {
    let s = `${d.label} 等級${t.level}\n`;
    s += `費用：£${t.cost}`;
    if (t.coalCost) s += ` + 煤炭×${t.coalCost}`;
    if (t.ironCost) s += ` + 鐵×${t.ironCost}`;
    s += `\n收入：+${t.income} | 分數：${t.vp} | 路線分：${t.linkVP}`;
    if (t.resourceAmount > 0) {
      const rn = t.type === 'coal' ? '煤炭' : t.type === 'iron' ? '鐵' : '啤酒';
      s += `\n產出：${rn}×${t.resourceAmount}`;
    }
    if (t.sellBeer > 0) s += `\n販賣需要：啤酒×${t.sellBeer}`;
    if (t.eraMin === 'rail') s += '\n（僅限鐵路時代）';
    return s;
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
      `<br><span style="color:var(--text-dim);font-size:.85em">軌道格 ${myPos}  |  借貸退3級=${myLevel >= -7 ? '→£'+(myLevel-3) : '禁止'}</span>`;
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
      const spacesPerLevel = val <= 0 ? 1 : val <= 10 ? 2 : val <= 20 ? 3 : 4;
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
      if (card.type === 'location') {
        typeLabel = '地點牌';
        nameLabel = card.name;
        detailLabel = '在此城市建造';
      } else if (card.type === 'industry') {
        typeLabel = '產業牌';
        const d = INDUSTRY_DISPLAY[card.industry];
        nameLabel = d ? `${d.label}` : card.name;
        detailLabel = '在網路上任意處建造';
      } else if (card.type === 'wild_location') {
        typeLabel = '萬能牌';
        nameLabel = '任意地點';
        detailLabel = '可在任何城市建造';
      } else if (card.type === 'wild_industry') {
        typeLabel = '萬能牌';
        nameLabel = '任意產業';
        detailLabel = '可建造任何類型';
      } else {
        typeLabel = card.type;
        nameLabel = card.name;
      }

      el.innerHTML = `
        <div class="card-type">${typeLabel}</div>
        <div class="card-name">${nameLabel}</div>
        <div class="card-detail">${detailLabel}</div>
      `;

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
          const myPid = this.myPlayerId;
          const myNetwork = new Set();
          if (state && state.board && myPid) {
            // DEBUG
            const owners = [];
            for (const loc of Object.values(state.board)) {
              for (const slot of loc.slots) {
                if (slot.built) owners.push(slot.built.owner);
              }
            }
            const linkOwners = (state.links||[]).map(l => l.owner);
            console.log('Hover DEBUG: myPid='+myPid+' owners='+[...new Set(owners)]+' linkOwners='+[...new Set(linkOwners)]);
            // 沒有建築和路線時可以蓋任何地方
            let hasBuildings = false;
            for (const [cid, loc] of Object.entries(state.board)) {
              for (const slot of loc.slots) {
                if (slot.built && slot.built.owner === myPid) {
                  hasBuildings = true; break;
                }
              }
              if (hasBuildings) break;
            }
            // 也檢查是否有路線
            if (!hasBuildings && state.links) {
              hasBuildings = state.links.some(l => l.owner === myPid);
            }
            // BFS 找網路
            // 起點 = 有你建築的城市 + 你路線相鄰的城市
            if (hasBuildings) {
              // 1. 有你建築的城市
              for (const [cid, loc] of Object.entries(state.board)) {
                for (const slot of loc.slots) {
                  if (slot.built && slot.built.owner === myPid) {
                    myNetwork.add(cid);
                  }
                }
              }
              // 2. 你的路線相鄰的城市
              if (state.links) {
                for (const link of state.links) {
                  if (link.owner === myPid) {
                    myNetwork.add(link.from);
                    myNetwork.add(link.to);
                  }
                }
              }
              // 3. 透過所有人的路線 BFS 擴展
              if (state.links) {
                let changed = true;
                while (changed) {
                  changed = false;
                  for (const link of state.links) {
                    if (myNetwork.has(link.from) && !myNetwork.has(link.to)) {
                      myNetwork.add(link.to); changed = true;
                    }
                    if (myNetwork.has(link.to) && !myNetwork.has(link.from)) {
                      myNetwork.add(link.from); changed = true;
                    }
                  }
                }
              }
            }

            for (const [cid, loc] of Object.entries(state.board)) {
              let hasMatchingSlot = false;
              for (const slot of loc.slots) {
                if (!slot.built && slot.types && slot.types.includes(card.industry)) {
                  hasMatchingSlot = true; break;
                }
              }
              if (hasMatchingSlot) {
                if (!hasBuildings || myNetwork.has(cid)) {
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
        if (state) r.render(state);
      });
      el.addEventListener('mouseleave', () => {
        if (window.renderer) {
          window.renderer.highlightedCities = [];
          window.renderer.dimHighlightedCities = [];
          if (state) window.renderer.render(state);
        }
      });

      c.appendChild(el);
    });
  }

  /* ─── 行動按鈕 ─── */
  updateActionButtons(state, myPlayerId) {
    const ok = state.currentPlayerId === myPlayerId && !state.gameOver;
    document.querySelectorAll('.action-btn').forEach(b => {
      b.disabled = !ok;
      b.classList.remove('selected');
    });
    if (this.selectedAction) {
      const b = document.querySelector(`[data-action="${this.selectedAction}"]`);
      if (b) b.classList.add('selected');
    }
  }

  /* ─── 遊戲記錄 ─── */
  updateLog(state) {
    const c = document.getElementById('log-content');
    c.innerHTML = '';
    for (const e of state.log) {
      const d = document.createElement('div');
      d.className = 'log-entry';
      if (e.message.startsWith('===')) d.classList.add('highlight');
      d.textContent = e.message;
      c.appendChild(d);
    }
    c.scrollTop = c.scrollHeight;
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
        <span>${p.name}</span>
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
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}
