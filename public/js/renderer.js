// Canvas renderer for Brass: Birmingham board – enhanced version

class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hoveredCity = null;
    this.selectedCity = null;
    this.selectedSlot = null;
    this.highlightedCities = [];
    this.dimHighlightedCities = [];
    this.hoveredMerchant = null;
    this.gameState = null;

    // Slot geometry（正方形 42px）
    this.SLOT_W = 42;
    this.SLOT_H = 42;
    this.SLOT_GAP = 4;

    // 縮放和平移
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.MIN_ZOOM = 0.5;
    this.MAX_ZOOM = 3;
    this._setupZoomPan();

    // requestAnimationFrame 節流
    this._renderQueued = false;

    // Load board image → cache to offscreen canvas so we blit a pre-rendered
    // bitmap each frame instead of re-scaling the source image every time.
    this.boardImage = new Image();
    this.boardImage.src = BOARD_IMAGE_SRC;
    this.boardImageLoaded = false;
    this._boardOffscreen = null; // OffscreenCanvas / HTMLCanvasElement cache
    this.boardImage.onload = () => {
      this.boardImageLoaded = true;
      this._buildBoardCache();
      if (this.gameState) this.render(this.gameState);
    };
  }

  _setupZoomPan() {
    const canvas = this.canvas;

    // 滾輪縮放
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

      const oldZoom = this.zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * delta));

      // 以滑鼠位置為中心縮放
      this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom);
      this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);

      if (this.gameState) this.render(this.gameState);
    }, { passive: false });

    // 中鍵或右鍵拖拽平移
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) { // 中鍵或右鍵
        e.preventDefault();
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        this.panX += (e.clientX - this.panStartX) * scale;
        this.panY += (e.clientY - this.panStartY) * scale;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        if (this.gameState) this.render(this.gameState);
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 1 || e.button === 2) this.isPanning = false;
    });

    canvas.addEventListener('mouseleave', () => { this.isPanning = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 雙擊重置縮放
    canvas.addEventListener('dblclick', (e) => {
      this.zoom = 1; this.panX = 0; this.panY = 0;
      if (this.gameState) this.render(this.gameState);
    });

    // === 觸控支援（手機平移/縮放）===
    let lastTouchDist = 0;
    let lastTouchMid = null;

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isPanning = true;
        this.panStartX = e.touches[0].clientX;
        this.panStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isPanning = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
        lastTouchMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isPanning) {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        this.panX += (e.touches[0].clientX - this.panStartX) * scale;
        this.panY += (e.touches[0].clientY - this.panStartY) * scale;
        this.panStartX = e.touches[0].clientX;
        this.panStartY = e.touches[0].clientY;
        if (this.gameState) this.scheduleRender(this.gameState);
      } else if (e.touches.length === 2 && lastTouchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / lastTouchDist;
        const rect = canvas.getBoundingClientRect();
        const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * (canvas.width / rect.width);
        const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * (canvas.height / rect.height);

        const oldZoom = this.zoom;
        this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * ratio));
        this.panX = midX - (midX - this.panX) * (this.zoom / oldZoom);
        this.panY = midY - (midY - this.panY) * (this.zoom / oldZoom);

        lastTouchDist = dist;
        if (this.gameState) this.scheduleRender(this.gameState);
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) { lastTouchDist = 0; lastTouchMid = null; }
      if (e.touches.length === 0) this.isPanning = false;
    });
  }

  // 建立靜態棋盤的 offscreen 快取（加上半透明遮罩）
  _buildBoardCache() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    let oc;
    try {
      oc = new OffscreenCanvas(W, H);
    } catch (_) {
      oc = document.createElement('canvas');
      oc.width = W; oc.height = H;
    }
    const octx = oc.getContext('2d');
    octx.drawImage(this.boardImage, 0, 0, W, H);
    octx.fillStyle = 'rgba(0,0,0,0.15)';
    octx.fillRect(0, 0, W, H);
    this._boardOffscreen = oc;
  }

  // 將螢幕座標轉換為地圖座標（考慮縮放和平移）
  screenToMap(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    };
  }

  // 節流版 render — hover/mousemove 等高頻場景使用
  scheduleRender(gameState) {
    this.gameState = gameState;
    if (!this._renderQueued) {
      this._renderQueued = true;
      requestAnimationFrame(() => {
        this._renderQueued = false;
        this.render(this.gameState);
      });
    }
  }

  /* ============================== main render ============================== */
  render(gameState) {
    this.gameState = gameState;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 清除整個畫布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // 套用縮放和平移
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // ── board image background (blit from offscreen cache) ──
    if (this._boardOffscreen) {
      ctx.drawImage(this._boardOffscreen, 0, 0);
    } else if (this.boardImageLoaded) {
      // cache not ready yet — draw directly this frame
      ctx.drawImage(this.boardImage, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#1e2e28';
      ctx.fillRect(0, 0, W, H);
    }

    // ── interactive layers (on top of board image) ──
    this.drawMerchantConnections(ctx);
    this.drawConnections(ctx, gameState);
    this.drawBuiltLinks(ctx, gameState);
    this.drawMerchants(ctx, gameState);
    this.drawCities(ctx, gameState);
    this.drawMarketPanel(ctx, gameState);
    this.drawProgressTrack(ctx, gameState);

    if (this.hoveredCity) {
      this.drawCityTooltip(ctx, this.hoveredCity, gameState);
    }
    if (this.hoveredMerchant) {
      this.drawMerchantTooltip(ctx, this.hoveredMerchant, gameState);
    }

    ctx.restore(); // 結束縮放/平移

    // 縮放提示（固定在畫面上，不隨縮放移動）
    if (this.zoom !== 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.roundRect(ctx, 10, this.canvas.height - 30, 120, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('\u{1F50D} ' + Math.round(this.zoom * 100) + '% (雙擊重置)', 16, this.canvas.height - 14);
    }
  }

  /* ========================== merchant connections ========================= */
  drawMerchantConnections(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,0,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    for (const mc of MERCHANT_CONNECTIONS) {
      const m = BOARD_MERCHANTS[mc.from];
      const c = BOARD_CITIES[mc.to];
      if (!m || !c) continue;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ========================== unbuilt connections ========================== */
  drawConnections(ctx, gs) {
    // Pre-build a Set of built link keys to avoid O(n×m) .find() inside the loop
    const builtLinkKeys = new Set();
    if (gs && gs.links) {
      for (const l of gs.links) {
        builtLinkKeys.add(l.from + '|' + l.to);
        builtLinkKeys.add(l.to + '|' + l.from);
      }
    }
    for (const conn of BOARD_CONNECTIONS) {
      const a = BOARD_CITIES[conn.from];
      const b = BOARD_CITIES[conn.to];
      if (!a || !b) continue;

      if (builtLinkKeys.has(conn.from + '|' + conn.to)) continue;

      // draw route line
      const isCanal = conn.type === 'canal';
      const isRail  = conn.type === 'rail';
      ctx.save();
      ctx.lineWidth = 4;
      if (isCanal) {
        ctx.strokeStyle = 'rgba(74,144,217,0.25)';
        ctx.setLineDash([10, 4]);
      } else if (isRail) {
        ctx.strokeStyle = 'rgba(139,69,19,0.25)';
        ctx.setLineDash([4, 6]);
      } else {
        ctx.strokeStyle = 'rgba(200,200,200,0.15)';
        ctx.setLineDash([]);
      }
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();

      // midpoint badge
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.fillStyle = isCanal ? 'rgba(74,144,217,0.35)' :
                      isRail  ? 'rgba(139,69,19,0.35)' :
                                'rgba(180,180,180,0.2)';
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      // tiny label
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isCanal ? 'C' : isRail ? 'R' : '', mx, my + 3);
    }
  }

  /* ============================= built links ============================== */
  _getPos(id) {
    return BOARD_CITIES[id] || BOARD_MERCHANTS[id] || null;
  }

  // 取得路線視覺參數（端點偏移+彎曲）
  _getRouteVisual(fromId, toId) {
    if (typeof ROUTE_VISUAL === 'undefined') return null;
    return ROUTE_VISUAL[fromId + '|' + toId] || ROUTE_VISUAL[toId + '|' + fromId] || null;
  }

  // 畫一條路線（直線或貝茲曲線）
  _drawRoutePath(ctx, ax, ay, bx, by, rv) {
    ctx.beginPath();
    if (rv && rv.curve) {
      // 貝茲曲線：控制點在中點偏移
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      // curve 是垂直於路線方向的偏移
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = -dy / len, ny = dx / len; // 法向量
      const cx = mx + nx * rv.curve;
      const cy = my + ny * rv.curve;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
    } else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
  }

  drawBuiltLinks(ctx, gs) {
    if (!gs) return;
    for (const link of gs.links) {
      const a = this._getPos(link.from);
      const b = this._getPos(link.to);
      if (!a || !b) continue;
      const pidx = gs.turnOrder.indexOf(link.owner);
      const col = PLAYER_COLORS[pidx] || '#fff';

      // 取得路線視覺參數
      const rv = this._getRouteVisual(link.from, link.to);
      const soX = rv ? (rv.startOff || {x:0,y:0}).x : 0;
      const soY = rv ? (rv.startOff || {x:0,y:0}).y : 0;
      const eoX = rv ? (rv.endOff || {x:0,y:0}).x : 0;
      const eoY = rv ? (rv.endOff || {x:0,y:0}).y : 0;
      const ax = a.x + soX, ay = a.y + soY;
      const bx = b.x + eoX, by = b.y + eoY;

      // 白色外框
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 9;
      this._drawRoutePath(ctx, ax, ay, bx, by, rv);
      ctx.stroke();

      // 玩家顏色線
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      this._drawRoutePath(ctx, ax, ay, bx, by, rv);
      ctx.stroke();
      ctx.restore();

      // 中點標記
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      ctx.fillStyle = link.type === 'canal' ? '#4a90d9' : '#8B4513';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(link.type === 'canal' ? 'C' : 'R', mx, my + 3);
    }
  }

  /* =============================== merchants ============================== */
  drawMerchants(ctx, gs) {
    // 從遊戲狀態取得商人資料（含隨機板塊和啤酒狀態）
    const merchantState = gs ? gs.merchants : null;

    for (const [id, m] of Object.entries(BOARD_MERCHANTS)) {
      // 找到對應的遊戲狀態商人
      const ms = merchantState ? merchantState.find(s => s.id === id) : null;
      const isActive = ms ? ms.active !== false : true;
      const accepts = ms ? ms.accepts : (m.accepts || []);
      const beer = ms ? (ms.beer || 0) : 0;
      const bonusDesc = ms ? ms.bonusDesc : '';

      if (!isActive) continue; // 不顯示關閉的商人

      const r = 34;

      // 背景（半透明深色底板）
      ctx.save();
      ctx.shadowColor = 'rgba(255,215,0,0.3)'; ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      this.roundRect(ctx, m.x - r - 4, m.y - r + 4, (r + 4) * 2, r * 2 + 38, 10);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = '#b8922e'; ctx.lineWidth = 1.5;
      this.roundRect(ctx, m.x - r - 4, m.y - r + 4, (r + 4) * 2, r * 2 + 38, 10);
      ctx.stroke();

      // 商人名稱
      const shortName = m.name.replace('市場 ', '');
      ctx.fillStyle = '#d4a843'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(shortName, m.x, m.y - r + 18);

      // 接受的產業類型（大色塊）
      if (accepts.length > 0) {
        const chipW = 30, chipH = 18, gap = 4;
        const totalW = accepts.length * (chipW + gap) - gap;
        const startX = m.x - totalW / 2;
        const chipY = m.y - 6;

        for (let i = 0; i < accepts.length; i++) {
          const d = INDUSTRY_DISPLAY[accepts[i]];
          if (!d) continue;
          const cx = startX + i * (chipW + gap);

          ctx.fillStyle = d.iconBg;
          this.roundRect(ctx, cx, chipY, chipW, chipH, 4);
          ctx.fill();

          ctx.fillStyle = d.textColor;
          ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(d.short, cx + chipW / 2, chipY + chipH - 5);
        }
      } else {
        ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('（關閉）', m.x, m.y);
      }

      // 啤酒桶（放在每個商人格子旁邊，沒有框框）
      if (ms && ms.tiles) {
        for (let ti = 0; ti < ms.tiles.length; ti++) {
          const tile = ms.tiles[ti];
          const slotOff = CITY_SLOT_OFFSETS[id + '-' + ti] || {x:0,y:0};
          const n = ms.tiles.length;
          const totalW = n * (42 + 4) - 4;
          const bx = m.x - totalW/2 + ti * 46 + slotOff.x + 21;
          const by = m.y - 42/2 + 6 + slotOff.y + 42 + 4;

          if (tile.beer > 0) {
            ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('\u{1F37A}', bx, by + 16);
          } else if (tile.type !== 'closed') {
            ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillText('\u2717', bx, by + 14);
          }
        }
      } else if (beer > 0) {
        // 後備：沒有 tiles 資料時用總數
        ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
        for (let bi = 0; bi < beer; bi++) {
          ctx.fillText('\u{1F37A}', m.x - 12 + bi * 24, m.y + 40);
        }
      }

      // 獎勵提示
      if (bonusDesc) {
        ctx.fillStyle = 'rgba(255,215,0,0.6)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(bonusDesc, m.x, m.y + 58);
      }
    }
  }

  drawHexagon(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /* ================================ cities ================================ */
  drawCities(ctx, gs) {
    // O(1) lookups instead of O(n) .includes() per city per frame
    const highlightedSet = new Set(this.highlightedCities);
    const dimHighlightedSet = new Set(this.dimHighlightedCities);
    for (const [cid, pos] of Object.entries(BOARD_CITIES)) {
      const cd = gs ? gs.board[cid] : null;
      const hovered = this.hoveredCity === cid;
      const selected = this.selectedCity === cid;
      const highlighted = highlightedSet.has(cid);
      const dimHighlighted = dimHighlightedSet.has(cid);
      const nSlots = cd ? cd.slots.length : 1;

      // 只在 hover/selected/highlighted 時畫高亮（不畫半透明背景）
      if (selected || highlighted || dimHighlighted || hovered) {
        const totalW = nSlots * (this.SLOT_W + this.SLOT_GAP) - this.SLOT_GAP + 20;
        const totalH = this.SLOT_H + 20;
        const bx = pos.x - totalW / 2;
        const by = pos.y - totalH / 2;

        ctx.save();
        if (selected) { ctx.shadowColor = '#e94560'; ctx.shadowBlur = 14; }
        else if (highlighted) { ctx.shadowColor = '#3ba55d'; ctx.shadowBlur = 18; }
        else if (dimHighlighted) { ctx.shadowColor = '#aa8833'; ctx.shadowBlur = 8; }
        else { ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; }

        ctx.fillStyle = selected ? 'rgba(233,69,96,0.15)' :
                        highlighted ? 'rgba(59,165,93,0.15)' :
                        dimHighlighted ? 'rgba(170,136,51,0.08)' :
                        'rgba(255,255,255,0.08)';
        ctx.strokeStyle = selected ? '#e94560' :
                          highlighted ? '#3ba55d' :
                          dimHighlighted ? 'rgba(170,136,51,0.4)' :
                          'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        this.roundRect(ctx, bx, by, totalW, totalH, 8);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // ── draw slots ──
      if (cd) this.drawSlots(ctx, pos, cd, cid);
    }
  }

  /* ============================== slot tiles ============================== */
  drawSlots(ctx, pos, cd, cid) {
    const S = this.SLOT_W, H = this.SLOT_H, G = this.SLOT_GAP;
    const n = cd.slots.length;
    const totalW = n * (S + G) - G;
    const baseX = pos.x - totalW / 2;
    const baseY = pos.y - H / 2 + 6;

    for (let i = 0; i < n; i++) {
      const slot = cd.slots[i];
      // 每個格子獨立偏移
      const slotOff = CITY_SLOT_OFFSETS[cid + '-' + i] || { x: 0, y: 0 };
      const sx = baseX + i * (S + G) + slotOff.x;
      const sy = baseY + slotOff.y;
      const isSelSlot = this.selectedCity === cid && this.selectedSlot === i;

      if (slot.built) {
        this.drawBuiltTile(ctx, sx, sy, S, H, slot.built, isSelSlot);
      } else {
        this.drawEmptySlot(ctx, sx, sy, S, H, slot.types, isSelSlot);
      }
    }
  }

  /* ---------- built tile ---------- */
  drawBuiltTile(ctx, x, y, w, h, tile, highlight) {
    const d = INDUSTRY_DISPLAY[tile.type];
    const pidx = this.gameState ? this.gameState.turnOrder.indexOf(tile.owner) : 0;
    const pCol = PLAYER_COLORS[pidx] || '#888';
    const pLight = PLAYER_LIGHT_COLORS[pidx] || '#ccc';

    // 玩家顏色粗邊框（始終顯示，翻面前後都能看出是誰的）
    ctx.save();
    ctx.strokeStyle = pCol;
    ctx.lineWidth = 3;
    ctx.shadowColor = pCol;
    ctx.shadowBlur = tile.flipped ? 4 : 8;
    this.roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 6);
    ctx.stroke();
    ctx.restore();

    // 板塊背景
    ctx.fillStyle = tile.flipped ? d.iconBg : pCol;
    this.roundRect(ctx, x, y, w, h, 5);
    ctx.fill();

    // 翻面金色內框
    if (tile.flipped) {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
      this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 4);
      ctx.stroke();
    }

    // 產業類型色條（頂部）
    ctx.fillStyle = d.iconBg;
    this.roundRectTop(ctx, x, y, w, 12, 5);
    ctx.fill();

    // 產業名
    ctx.fillStyle = d.textColor; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.short, x + w / 2, y + 10);

    // 等級數字
    ctx.fillStyle = tile.flipped ? d.textColor : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(tile.level, x + w / 2, y + 28);

    // 玩家名字（左下角，用玩家顏色）
    ctx.fillStyle = pCol;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(tile.ownerName ? tile.ownerName.slice(0, 3) : '?', x + 2, y + h - 3);

    // resource cubes
    if (tile.resources > 0) {
      const cubeColor = tile.type === 'coal' ? '#222' :
                        tile.type === 'iron' ? '#CD853F' : '#FFD700';
      const cubeBorder = tile.type === 'coal' ? '#666' :
                         tile.type === 'iron' ? '#fff' : '#b8922e';
      const cSize = 7;
      const maxPerRow = 3;
      for (let r = 0; r < tile.resources; r++) {
        const col = r % maxPerRow;
        const row = Math.floor(r / maxPerRow);
        const cx = x + 5 + col * (cSize + 2);
        const cy = y + h - 5 - (row + 1) * (cSize + 1);
        ctx.fillStyle = cubeColor;
        ctx.fillRect(cx, cy, cSize, cSize);
        ctx.strokeStyle = cubeBorder; ctx.lineWidth = 0.8;
        ctx.strokeRect(cx, cy, cSize, cSize);
      }
    }

    // flipped checkmark
    if (tile.flipped) {
      ctx.fillStyle = '#27ae60'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('\u2713', x + 6, y + h - 4);
    }

    // selection highlight
    if (highlight) {
      ctx.strokeStyle = '#e94560'; ctx.lineWidth = 3;
      this.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 7);
      ctx.stroke();
    }
  }

  /* ---------- empty slot ---------- */
  drawEmptySlot(ctx, x, y, w, h, types, highlight) {
    // dashed border
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.2;
    this.roundRect(ctx, x, y, w, h, 5);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // draw each allowed type as a coloured chip
    const chipH = Math.min(14, (h - 6) / types.length - 2);
    const cY0 = y + (h - types.length * (chipH + 2) + 2) / 2;
    for (let t = 0; t < types.length; t++) {
      const d = INDUSTRY_DISPLAY[types[t]];
      if (!d) continue;
      const cy = cY0 + t * (chipH + 2);

      // chip bg
      ctx.fillStyle = d.iconBg;
      ctx.globalAlpha = 0.7;
      this.roundRect(ctx, x + 3, cy, w - 6, chipH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      // chip label
      ctx.fillStyle = d.textColor;
      ctx.font = `bold ${Math.min(10, chipH - 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(d.short, x + w / 2, cy + chipH - 3);
    }

    if (highlight) {
      ctx.strokeStyle = '#e94560'; ctx.lineWidth = 3; ctx.setLineDash([]);
      this.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 7);
      ctx.stroke();
    }
  }

  /* ============================= legend panel ============================= */
  /* ============================ market panels ============================= */
  drawMarketPanel(ctx, gs) {
    if (!gs) return;

    // 校正過的市場格子參數
    const slotW = 14, slotH = 14, gapX = 3, gapY = 16;
    const dotR = 5;

    // 校正過的起點座標（煤在左，鐵在右，各自獨立的格子列）
    const coalOrigin = { x: 834, y: 317 };
    const ironOrigin = { x: 891, y: 379 };
    // 煤用較小間距避免和鐵重疊：7行需要 7*(14+gapY) 空間
    // 從 y=317 到 y=317+6*30=497；鐵從 y=379 開始
    // 如果重疊就縮小煤的 gapY

    // ── 煤炭（黑色實心點）每行2個，共7行 ──
    const coalPrices = COAL_MARKET_PRICES_DISPLAY; // [1,1,2,2,...,8,8] 便宜→貴
    const coalSize = COAL_MARKET_SIZE; // 14
    const coalSupply = gs.coalMarket;

    // 從最貴開始排列（index 13,12 在第一行...index 1,0 在最後行）
    for (let i = 0; i < coalSize; i++) {
      const slotIdx = coalSize - 1 - i; // 13,12,11,...,1,0
      const row = Math.floor(i / 2);
      const col = i % 2;
      const x = coalOrigin.x + col * (slotW + gapX);
      const y = coalOrigin.y + row * (slotH + gapY);
      const filled = slotIdx >= (coalSize - coalSupply);

      if (filled) {
        // 黑色實心點
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.stroke();
      } else {
        // 空格虛線圈
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── 鐵（橘色實心點）每行2個，共5行 ──
    const ironPrices = IRON_MARKET_PRICES_DISPLAY; // [1,1,2,2,...,6,6]
    const ironSize = IRON_MARKET_SIZE; // 10
    const ironSupply = gs.ironMarket;

    for (let i = 0; i < ironSize; i++) {
      const slotIdx = ironSize - 1 - i;
      const row = Math.floor(i / 2);
      const col = i % 2;
      const x = ironOrigin.x + col * (slotW + gapX);
      const y = ironOrigin.y + row * (slotH + gapY);
      const filled = slotIdx >= (ironSize - ironSupply);

      if (filled) {
        // 橘色實心點
        ctx.fillStyle = '#CD853F';
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(205,133,63,0.3)'; ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotH / 2, dotR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /* ======================== progress track overlay ===================== */
  drawProgressTrack(ctx, gs) {
    if (!gs) return;

    // 玩家狀態小面板（右下角，半透明）
    const px = this.canvas.width - 165, py = this.canvas.height - 110;
    const pw = 160, rowH = 22;
    const players = gs.turnOrder.map(pid => gs.players[pid]);
    const ph = players.length * rowH + 28;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.roundRect(ctx, px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1;
    this.roundRect(ctx, px, py, pw, ph, 8);
    ctx.stroke();

    // 標題
    ctx.fillStyle = '#d4a843'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('VP    收入    £', px + 28, py + 14);

    // 每個玩家一行
    players.forEach((p, idx) => {
      const ry = py + 22 + idx * rowH;
      const col = PLAYER_COLORS[idx];

      // 彩色圓點
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px + 12, ry + 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(px + 12, ry + 6, 5, 0, Math.PI * 2); ctx.stroke();

      // VP
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(p.vp, px + 28, ry + 10);

      // 收入等級
      const inc = p.income !== undefined ? p.income : 0;
      ctx.fillStyle = inc >= 0 ? '#7dcea0' : '#f88';
      ctx.fillText(`\u00A3${inc}`, px + 62, ry + 10);

      // 金錢
      ctx.fillStyle = '#e8d48b';
      ctx.fillText(`\u00A3${p.money}`, px + 105, ry + 10);
    });
  }

  /* ============================= city tooltip ============================= */
  drawCityTooltip(ctx, cityId, gs) {
    const pos = BOARD_CITIES[cityId];
    if (!pos) return;
    const cd = gs ? gs.board[cityId] : null;
    if (!cd) return;

    // build lines
    const lines = [];
    lines.push({ text: cd.name, bold: true, color: '#d4a843' });
    lines.push({ text: '', color: 'transparent' }); // spacer

    for (const slot of cd.slots) {
      if (slot.built) {
        const t = slot.built;
        const d = INDUSTRY_DISPLAY[t.type];
        const status = t.flipped ? ' [已翻面 \u2713]' :
                       t.resources > 0 ? ` [資源: ${t.resources}]` : '';
        lines.push({
          text: `${d.short} Lv${t.level}  ${t.ownerName}${status}`,
          color: t.flipped ? '#7dcea0' : '#eee',
          bg: d.iconBg
        });
      } else {
        const names = slot.types.map(t => INDUSTRY_DISPLAY[t].short).join(' / ');
        lines.push({ text: `[空位]  ${names}`, color: '#999' });
      }
    }

    const pad = 12;
    const lineH = 20;
    const boxW = 240;
    const boxH = lines.length * lineH + pad * 2;

    let tx = pos.x + 60;
    let ty = pos.y - boxH / 2;
    if (tx + boxW > this.canvas.width - 180) tx = pos.x - boxW - 60;
    if (ty < 5) ty = 5;
    if (ty + boxH > this.canvas.height - 5) ty = this.canvas.height - boxH - 5;

    // bg
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(10,15,25,0.94)';
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 1.5;
    this.roundRect(ctx, tx, ty, boxW, boxH, 8);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // text
    lines.forEach((line, i) => {
      const ly = ty + pad + i * lineH + lineH - 6;

      // optional colour chip
      if (line.bg) {
        ctx.fillStyle = line.bg; ctx.globalAlpha = 0.6;
        this.roundRect(ctx, tx + pad, ly - 10, 14, 14, 3);
        ctx.fill(); ctx.globalAlpha = 1;
      }

      ctx.fillStyle = line.color;
      ctx.font = line.bold ? 'bold 13px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(line.text, tx + pad + (line.bg ? 18 : 0), ly);
    });
  }

  /* ============================= helpers ================================== */
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── hit test: city ── */
  getCityAt(mx, my) {
    // 先搜城市
    for (const [cid, pos] of Object.entries(BOARD_CITIES)) {
      const cd = this.gameState ? this.gameState.board[cid] : null;
      const n = cd ? cd.slots.length : 1;
      const tw = n * (this.SLOT_W + this.SLOT_GAP) - this.SLOT_GAP + 20;
      const th = this.SLOT_H + 28;
      const bx = pos.x - tw / 2;
      const by = pos.y - th / 2 + 4;
      if (mx >= bx - 5 && mx <= bx + tw + 5 && my >= by - 18 && my <= by + th + 5) return cid;
    }
    // 也搜商人位置（建路時需要點擊商人作為端點）
    for (const [mid, pos] of Object.entries(BOARD_MERCHANTS)) {
      if (Math.hypot(mx - pos.x, my - pos.y) < 45) return mid;
    }
    return null;
  }

  /* ── hit test: slot within a city ── */
  getSlotAt(mx, my, cid) {
    const pos = BOARD_CITIES[cid];
    if (!pos || !this.gameState) return -1;
    const cd = this.gameState.board[cid];
    if (!cd) return -1;

    const S = this.SLOT_W, H = this.SLOT_H, G = this.SLOT_GAP;
    const n = cd.slots.length;
    const totalW = n * (S + G) - G;
    const baseX = pos.x - totalW / 2;
    const baseY = pos.y - H / 2 + 6;

    for (let i = 0; i < n; i++) {
      const slotOff = CITY_SLOT_OFFSETS[cid + '-' + i] || { x: 0, y: 0 };
      const sx = baseX + i * (S + G) + slotOff.x;
      const sy = baseY + slotOff.y;
      if (mx >= sx && mx <= sx + S && my >= sy && my <= sy + H) return i;
    }
    return -1;
  }

  /* ── hit test: merchant ── */
  getMerchantAt(mx, my) {
    for (const [mid, m] of Object.entries(BOARD_MERCHANTS)) {
      if (Math.hypot(mx - m.x, my - m.y) < 40) return mid;
    }
    return null;
  }

  /* ── merchant tooltip ── */
  drawMerchantTooltip(ctx, merchantId, gs) {
    const m = BOARD_MERCHANTS[merchantId];
    if (!m) return;

    // 從遊戲狀態取商人資料
    const ms = gs && gs.merchants ? gs.merchants.find(s => s.id === merchantId) : null;
    if (!ms || ms.active === false) return;

    const accepts = ms.accepts || [];
    const beer = ms.beer || 0;
    const bonusDesc = ms.bonusDesc || '';
    const connectedTo = ms.connectedTo || [];

    const lines = [];
    lines.push({ text: ms.name || m.name, bold: true, color: '#d4a843' });
    lines.push({ text: '', color: 'transparent' });

    // 接受的產業
    if (accepts.length > 0) {
      const names = accepts.map(t => INDUSTRY_DISPLAY[t] ? INDUSTRY_DISPLAY[t].label : t).join('、');
      lines.push({ text: `接受：${names}`, color: '#eee' });
    } else {
      lines.push({ text: '（未放置商人板塊）', color: '#888' });
    }

    // 啤酒狀態
    lines.push({ text: beer > 0 ? `🍺 啤酒桶：${beer}（可用於販賣）` : '啤酒桶：已用完', color: beer > 0 ? '#ffd700' : '#888' });

    // 獎勵
    if (bonusDesc) {
      lines.push({ text: `獎勵：${bonusDesc}`, color: '#7dcea0' });
    }

    // 連接城市
    if (connectedTo.length > 0) {
      const cityNames = connectedTo.map(cid => {
        const cd = gs && gs.board[cid];
        return cd ? cd.name : cid;
      }).join('、');
      lines.push({ text: `相鄰城市：${cityNames}`, color: '#aaa' });
    }

    // 繪製 tooltip
    const pad = 12, lineH = 20, boxW = 260;
    const boxH = lines.length * lineH + pad * 2;

    let tx = m.x + 50;
    let ty = m.y - boxH / 2;
    if (tx + boxW > this.canvas.width) tx = m.x - boxW - 50;
    if (ty < 5) ty = 5;
    if (ty + boxH > this.canvas.height - 5) ty = this.canvas.height - boxH - 5;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(10,15,25,0.94)';
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 1.5;
    this.roundRect(ctx, tx, ty, boxW, boxH, 8);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    lines.forEach((line, i) => {
      const ly = ty + pad + i * lineH + lineH - 6;
      ctx.fillStyle = line.color;
      ctx.font = line.bold ? 'bold 13px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(line.text, tx + pad, ly);
    });
  }
}
