// 輸入處理 - 工業革命：伯明翰

class InputHandler {
  constructor(renderer, ui, socket) {
    this.renderer = renderer;
    this.ui = ui;
    this.socket = socket;
    this.gameState = null;

    this.setupCanvasEvents();
    this.setupActionButtons();
    this.setupDetailButtons();
  }

  setGameState(state) { this.gameState = state; }

  setupCanvasEvents() {
    const canvas = this.renderer.canvas;
    canvas.addEventListener('mousemove', (e) => {
      if (this.renderer.isPanning) return;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const { x, y } = this.renderer.screenToMap(sx, sy);
      const city = this.renderer.getCityAt(x, y);
      const merchant = !city ? this.renderer.getMerchantAt(x, y) : null;
      let needRender = false;
      if (city !== this.renderer.hoveredCity) {
        this.renderer.hoveredCity = city;
        needRender = true;
      }
      if (merchant !== this.renderer.hoveredMerchant) {
        this.renderer.hoveredMerchant = merchant;
        needRender = true;
      }
      if (needRender && this.gameState) this.renderer.scheduleRender(this.gameState);
    });
    canvas.addEventListener('click', (e) => {
      if (this.renderer.isPanning) return;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const { x, y } = this.renderer.screenToMap(sx, sy);
      const city = this.renderer.getCityAt(x, y);
      if (city) this.onCityClick(city, x, y);
    });
  }

  setupActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => this.startAction(btn.dataset.action));
    });
  }

  setupDetailButtons() {
    document.getElementById('btn-confirm-action').addEventListener('click', () => this.confirmAction());
    document.getElementById('btn-cancel-action').addEventListener('click', () => {
      this.ui.cancelAction();
      this.renderer.selectedCity = null;
      this.renderer.selectedSlot = null;
      if (this.gameState) this.renderer.render(this.gameState);
    });
  }

  // ====== 點擊城市 ======
  onCityClick(cityId, x, y) {
    const action = this.ui.selectedAction;

    if (action === 'build') {
      if (this.renderer.selectedCity === cityId) {
        const slot = this.renderer.getSlotAt(x, y, cityId);
        if (slot >= 0) {
          this.renderer.selectedSlot = slot;
          this.ui.actionState.slotIndex = slot;
          this.updateBuildDetail();
        }
      } else {
        this.renderer.selectedCity = cityId;
        this.renderer.selectedSlot = null;
        this.ui.actionState.locationId = cityId;
        this.ui.actionState.slotIndex = null;
        this.updateBuildDetail();
      }
      if (this.gameState) this.renderer.render(this.gameState);

    } else if (action === 'network') {
      if (!this.ui.actionState.links) this.ui.actionState.links = [];
      if (!this.ui.actionState.linkFrom) {
        this.ui.actionState.linkFrom = cityId;
        this.renderer.selectedCity = cityId;
        this.ui.showActionDetail('建路', `起點：${cityId}<br>點擊目的地城市`);
      } else {
        const from = this.ui.actionState.linkFrom;
        this.ui.actionState.links.push({ from, to: cityId });
        this.ui.actionState.linkFrom = null;
        this.renderer.selectedCity = null;
        const isCanal = this.gameState && this.gameState.era === 'canal';
        const maxLinks = isCanal ? 1 : 2;
        if (this.ui.actionState.links.length >= maxLinks) {
          this.updateNetworkDetail();
        } else {
          // 鐵路時代：已選1條時，可選擇確認或繼續選第2條
          this.ui.showActionDetail('建路',
            `已選 ${this.ui.actionState.links.length}/${maxLinks} 條路<br>` +
            `點擊下一條路的起點，或直接點「確認」只建 1 條`);
        }
      }
      if (this.gameState) this.renderer.render(this.gameState);

    } else if (action === 'sell') {
      if (!this.ui.actionState.sales) this.ui.actionState.sales = [];
      const cityData = this.gameState.board[cityId];
      if (!cityData) return;
      const sellable = [];
      cityData.slots.forEach((slot, idx) => {
        if (slot.built && !slot.built.flipped &&
            ['cotton', 'manufacturer', 'pottery'].includes(slot.built.type) &&
            slot.built.owner === this.ui.myPlayerId) {
          sellable.push({ locationId: cityId, slotIndex: idx });
        }
      });
      if (sellable.length === 0) return;

      if (sellable.length === 1) {
        // 只有一個可賣，直接 toggle
        const s = sellable[0];
        const existing = this.ui.actionState.sales.findIndex(
          x => x.locationId === s.locationId && x.slotIndex === s.slotIndex);
        if (existing >= 0) this.ui.actionState.sales.splice(existing, 1);
        else this.ui.actionState.sales.push(s);
        this.updateSellDetail();
      } else {
        // 多個可賣建築，讓玩家逐個選擇
        const options = sellable.map(s => {
          const slot = cityData.slots[s.slotIndex];
          const d = INDUSTRY_DISPLAY[slot.built.type];
          const already = this.ui.actionState.sales.some(
            x => x.locationId === s.locationId && x.slotIndex === s.slotIndex);
          return {
            label: `${d.label} Lv${slot.built.level}${already ? '（已選，點擊取消）' : ''}`,
            value: s
          };
        });
        this.ui.showSelection(`${cityData.name} — 選擇要販賣的建築`, options, (s) => {
          const existing = this.ui.actionState.sales.findIndex(
            x => x.locationId === s.locationId && x.slotIndex === s.slotIndex);
          if (existing >= 0) this.ui.actionState.sales.splice(existing, 1);
          else this.ui.actionState.sales.push(s);
          this.updateSellDetail();
        });
      }
    }
  }

  // ====== 啟動行動 ======
  startAction(action) {
    if (!this.gameState || this.gameState.currentPlayerId !== this.ui.myPlayerId) {
      this.ui.showError('不是你的回合！');
      return;
    }
    this.ui.selectedAction = action;
    this.ui.actionState = {};
    this.renderer.selectedCity = null;
    this.renderer.selectedSlot = null;
    this.ui.updateActionButtons(this.gameState, this.ui.myPlayerId);

    switch (action) {
      case 'build': this.startBuild(); break;
      case 'network': this.startNetwork(); break;
      case 'develop': this.startDevelop(); break;
      case 'sell': this.startSell(); break;
      case 'loan': this.startLoan(); break;
      case 'scout': this.startScout(); break;
      case 'pass': this.startPass(); break;
    }
  }

  // ====== 建造 ======
  startBuild() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌！');
      this.ui.cancelAction(); return;
    }
    const card = this.gameState.myHand[this.ui.selectedCardIndex];
    this.ui.showActionDetail('建造',
      `卡片：${card.name}<br>請點擊地圖上的城市，再點擊格子`);
  }

  updateBuildDetail() {
    const state = this.ui.actionState;
    const cityData = this.gameState.board[state.locationId];
    if (!cityData) return;

    let html = `<b>城市：</b>${cityData.name}<br>`;
    if (state.slotIndex !== null && state.slotIndex !== undefined) {
      const slot = cityData.slots[state.slotIndex];
      if (slot) {
        html += `<b>格子：</b>${state.slotIndex + 1}（`;
        html += slot.types.map(t => INDUSTRY_DISPLAY[t].label).join(' / ');
        html += '）<br>';

        if (!slot.built) {
          if (slot.types.length === 1) {
            state.industryType = slot.types[0];
            html += this._buildCostInfo(state.industryType);
            html += '<br><b style="color:#3ba55d">點擊「確認」建造</b>';
          } else {
            html += '選擇要建造的產業：<br>';
            for (const t of slot.types) {
              html += `<button class="selection-option ind-type-btn" data-ind-type="${t}" style="margin:4px 2px;font-size:0.95em">${INDUSTRY_DISPLAY[t].label}</button> `;
            }
          }
        } else {
          html += `目前：${INDUSTRY_DISPLAY[slot.built.type].label} 等級${slot.built.level}<br>`;
          html += '<b style="color:#e06040">將會覆蓋此建築</b>';
          state.industryType = slot.built.type;
          html += this._buildCostInfo(state.industryType);
        }
      }
    } else {
      html += '<span style="color:var(--text-dim)">請點擊城市中的格子</span>';
    }
    this.ui.showActionDetail('建造', html);
    // 綁定產業類型按鈕事件（取代 inline onclick）
    document.querySelectorAll('.ind-type-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectIndustryType(btn.dataset.indType));
    });
  }

  // 顯示建造費用資訊
  _buildCostInfo(industryType) {
    const player = this.gameState.players[this.ui.myPlayerId];
    if (!player) return '';
    const tiles = player.tiles[industryType];
    if (!tiles || tiles.length === 0) return '<br><span style="color:#e06040">沒有可用的板塊！</span>';

    // 找到目前時代可用的最低等級
    const era = this.gameState.era;
    const tile = tiles.find(t => !(t.era === 'canal' && era !== 'canal') && !(t.era === 'rail' && era !== 'rail'));
    if (!tile) return '<br><span style="color:#e06040">目前時代沒有可用板塊</span>';

    const d = INDUSTRY_DISPLAY[industryType];
    let html = '<div style="margin-top:6px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.95em">';
    html += `<b>${d.label} 等級${tile.level}</b><br>`;
    html += `\u00A3${tile.cost}`;
    if (tile.coalCost > 0) html += ` + 煤炭\u00D7${tile.coalCost}`;
    if (tile.ironCost > 0) html += ` + 鐵\u00D7${tile.ironCost}`;
    html += '<br>';
    html += `<span style="color:var(--text-dim)">收入 +${tile.income} ｜ 分數 ${tile.vp}</span>`;
    if (tile.resourceAmount > 0) {
      const resName = industryType === 'coal' ? '煤炭' : industryType === 'iron' ? '鐵' : '啤酒';
      html += `<br><span style="color:var(--text-dim)">產出 ${resName}\u00D7${tile.resourceAmount}</span>`;
    }
    if (tile.sellBeer > 0) {
      html += `<br><span style="color:var(--text-dim)">販賣需要 啤酒\u00D7${tile.sellBeer}</span>`;
    }
    html += `<br><span style="color:${player.money >= tile.cost ? '#3ba55d' : '#e06040'}">你的金錢：\u00A3${player.money}</span>`;
    html += '</div>';
    return html;
  }

  selectIndustryType(type) {
    this.ui.actionState.industryType = type;
    this.updateBuildDetail();
  }

  // ====== 建路 ======
  startNetwork() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌！');
      this.ui.cancelAction(); return;
    }
    this.ui.actionState.links = [];
    const isCanal = this.gameState.era === 'canal';
    const cost = isCanal ? 3 : 5;
    let html = `<b>${isCanal ? '運河' : '鐵路'}（${isCanal ? '1條' : '最多2條'}）</b><br>`;
    html += `費用：每條 \u00A3${cost}${isCanal ? '' : ' + 煤炭\u00D71'}<br>`;
    html += '點擊起點城市';
    this.ui.showActionDetail('建路', html);
  }

  updateNetworkDetail() {
    const links = this.ui.actionState.links;
    let html = '<b>已選路線：</b><br>';
    for (const l of links) html += `${l.from} \u2192 ${l.to}<br>`;
    html += '<br><b style="color:#3ba55d">點擊「確認」建路</b>';
    this.ui.showActionDetail('建路', html);
  }

  // ====== 研發 ======
  startDevelop() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌！');
      this.ui.cancelAction(); return;
    }

    const player = this.gameState.players[this.ui.myPlayerId];
    if (!player) return;

    this.ui.actionState.developTypes = [];
    this._showDevelopSelection(player, '選擇第 1 個要研發的產業（移除最低等級板塊，消耗鐵\u00D71）', true);
  }

  _showDevelopSelection(player, title, isFirst) {
    // 建立選項：顯示完整板塊資訊
    const options = [];
    for (const [type, tiles] of Object.entries(player.tiles)) {
      if (tiles.length === 0) continue;
      // 有💡標記的板塊不能研發
      if (tiles[0].noDevelop) continue;
      const d = INDUSTRY_DISPLAY[type];

      // 列出所有等級的數量
      const levelCounts = {};
      for (const t of tiles) {
        levelCounts[t.level] = (levelCounts[t.level] || 0) + 1;
      }
      const levelStr = Object.entries(levelCounts)
        .map(([lv, cnt]) => `Lv${lv}\u00D7${cnt}`)
        .join('  ');

      const lowestTile = tiles[0];
      options.push({
        label: `${d.label}  |  將移除 Lv${lowestTile.level}  |  剩餘：${levelStr}  (共${tiles.length}片)`,
        value: type
      });
    }

    if (!isFirst) {
      // 加入「只研發1個」的選項
      options.unshift({
        label: '\u2714 完成（只研發 1 個）',
        value: '__done__'
      });
    }

    this.ui.showSelection(title, options, (val) => {
      if (val === '__done__') {
        this.confirmAction();
        return;
      }
      this.ui.actionState.developTypes.push(val);

      if (isFirst) {
        // 問要不要研發第二個
        this._showDevelopSelection(player,
          '要再研發第 2 個嗎？（再消耗鐵\u00D71，或選「完成」只研發 1 個）', false);
      } else {
        this.confirmAction();
      }
    });
  }

  // ====== 販賣 ======
  startSell() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌！');
      this.ui.cancelAction(); return;
    }
    this.ui.actionState.sales = [];
    this.ui.showActionDetail('販賣',
      '點擊地圖上你要販賣的建築<br>（棉花、工廠、陶瓷）');
  }

  updateSellDetail() {
    const sales = this.ui.actionState.sales;
    let html = `<b>已選 ${sales.length} 個建築：</b><br>`;
    let totalBeer = 0;
    for (const s of sales) {
      const loc = this.gameState.board[s.locationId];
      const slot = loc.slots[s.slotIndex];
      const d = INDUSTRY_DISPLAY[slot.built.type];
      html += `${loc.name} - ${d.label} Lv${slot.built.level}`;
      if (slot.built.sellBeer > 0) {
        html += ` <span style="color:#ffd700">(需啤酒\u00D7${slot.built.sellBeer})</span>`;
        totalBeer += slot.built.sellBeer;
      }
      html += '<br>';
    }
    if (totalBeer > 0) {
      html += `<div style="margin-top:4px;color:var(--text-dim)">總共需要啤酒：${totalBeer}（從網路上的啤酒廠取得）</div>`;
    }
    html += '<div style="margin-top:4px;font-size:.85em;color:var(--text-dim)">注意：需要透過路線連接到外部商人才能販賣</div>';
    html += '<br><b style="color:#3ba55d">點擊「確認」販賣</b>';
    this.ui.showActionDetail('販賣', html);
  }

  // ====== 貸款 ======
  startLoan() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌！');
      this.ui.cancelAction(); return;
    }
    const player = this.gameState.players[this.ui.myPlayerId];
    this.ui.showActionDetail('貸款',
      `獲得 <b>\u00A330</b><br>收入等級 <b style="color:#e06040">-3</b><br>` +
      `<span style="color:var(--text-dim)">目前金錢：\u00A3${player.money}｜收入等級：${player.incomeLevel}</span><br>` +
      '<br><b style="color:#3ba55d">點擊「確認」</b>');
  }

  // ====== 偵查 ======
  startScout() {
    if (this.gameState.myHand.length < 3) {
      this.ui.showError('手牌不足 3 張！');
      this.ui.cancelAction(); return;
    }
    this.ui.actionState.scoutCards = [];
    this._updateScoutDetail();
  }

  _updateScoutDetail() {
    const selected = this.ui.actionState.scoutCards || [];
    let html = '棄掉 <b>3 張</b>手牌 → 獲得 1 萬能地點 + 1 萬能產業<br><br>';
    html += `已選 <b>${selected.length}/3</b> 張：<br>`;

    // 顯示手牌讓玩家點選
    const hand = this.gameState.myHand;
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0">';
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      const isSelected = selected.includes(i);
      const name = card.type === 'location' ? card.name :
                   card.type === 'industry' ? (INDUSTRY_DISPLAY[card.industry]?.label || card.name) :
                   card.name;
      const bg = isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
      const border = isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.15)';
      html += `<div class="scout-card-btn" data-card-idx="${i}" style="padding:5px 10px;border-radius:6px;cursor:pointer;background:${bg};border:1px solid ${border};font-size:0.9em">${escHtml(name)}</div>`;
    }
    html += '</div>';

    if (selected.length === 3) {
      html += '<br><b style="color:#3ba55d">已選好 3 張，點擊「確認」</b>';
    } else {
      html += `<span style="color:var(--text-dim)">再選 ${3 - selected.length} 張</span>`;
    }

    this.ui.showActionDetail('偵查', html);
    // 綁定偵查卡牌按鈕事件（取代 inline onclick）
    document.querySelectorAll('.scout-card-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleScoutCard(parseInt(btn.dataset.cardIdx)));
    });
  }

  toggleScoutCard(index) {
    const selected = this.ui.actionState.scoutCards;
    const pos = selected.indexOf(index);
    if (pos >= 0) {
      selected.splice(pos, 1);
    } else if (selected.length < 3) {
      selected.push(index);
    }
    this._updateScoutDetail();
  }

  // ====== 跳過 ======
  startPass() {
    if (this.ui.selectedCardIndex < 0) {
      this.ui.showError('請先選擇一張手牌（跳過時需棄牌）！');
      this.ui.cancelAction(); return;
    }
    const card = this.gameState.myHand[this.ui.selectedCardIndex];
    const cardName = card.type === 'location' ? card.name :
                     card.type === 'industry' ? (INDUSTRY_DISPLAY[card.industry]?.label || card.name) :
                     card.name;
    this.ui.showActionDetail('跳過',
      `確定要跳過這個行動嗎？<br><br>` +
      `將棄掉：<b style="color:var(--accent)">${cardName}</b><br><br>` +
      `<span style="color:var(--text-dim)">跳過不花錢，但必須棄一張牌。</span><br>` +
      `<br><b style="color:#3ba55d">點擊「確認」跳過</b>`);
    this.ui.actionState.passConfirmed = true;
  }

  // ====== 確認行動 ======
  confirmAction() {
    const action = this.ui.selectedAction;
    const state = this.ui.actionState;
    const cardIndex = this.ui.selectedCardIndex;

    switch (action) {
      case 'build':
        if (state.locationId && state.slotIndex !== null && state.industryType) {
          this.socket.emit('game-action', {
            actionType: 'build',
            params: { cardIndex, locationId: state.locationId, slotIndex: state.slotIndex, industryType: state.industryType }
          });
        } else { this.ui.showError('請完成所有選擇'); return; }
        break;

      case 'network':
        if (state.links && state.links.length > 0) {
          this.socket.emit('game-action', {
            actionType: 'network',
            params: { cardIndex, links: state.links }
          });
        } else { this.ui.showError('請選擇路線'); return; }
        break;

      case 'develop':
        if (state.developTypes && state.developTypes.length > 0) {
          this.socket.emit('game-action', {
            actionType: 'develop',
            params: { cardIndex, industryTypes: state.developTypes }
          });
        } else { this.ui.showError('請選擇產業'); return; }
        break;

      case 'sell':
        if (state.sales && state.sales.length > 0) {
          this.socket.emit('game-action', {
            actionType: 'sell',
            params: { cardIndex, sales: state.sales }
          });
        } else { this.ui.showError('請選擇要販賣的建築'); return; }
        break;

      case 'loan':
        this.socket.emit('game-action', {
          actionType: 'loan',
          params: { cardIndex }
        });
        break;

      case 'scout':
        if (!state.scoutCards || state.scoutCards.length !== 3) {
          this.ui.showError('請選擇 3 張手牌'); return;
        }
        this.socket.emit('game-action', {
          actionType: 'scout',
          params: { cardIndices: state.scoutCards }
        });
        break;

      case 'pass':
        this.socket.emit('pass-action', { cardIndex: this.ui.selectedCardIndex });
        break;
    }

    this.ui.selectedCardIndex = -1;
    this.ui.cancelAction();
    this.renderer.selectedCity = null;
    this.renderer.selectedSlot = null;
    if (this.gameState) this.renderer.render(this.gameState);
  }
}
