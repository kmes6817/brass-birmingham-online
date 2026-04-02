// Main entry point for Brass: Birmingham Online

const socket = io();
let renderer, ui, inputHandler, lobby;
let currentGameState = null;

// === 持久化玩家 ID（斷線重連用）===
function getStoredSession() {
  try {
    return {
      playerId: sessionStorage.getItem('brass_playerId'),
      roomId: sessionStorage.getItem('brass_roomId'),
      name: sessionStorage.getItem('brass_name'),
      token: sessionStorage.getItem('brass_token')
    };
  } catch { return {}; }
}

function saveSession(playerId, roomId, name, token) {
  try {
    if (playerId) sessionStorage.setItem('brass_playerId', playerId);
    if (roomId) sessionStorage.setItem('brass_roomId', roomId);
    if (name) sessionStorage.setItem('brass_name', name);
    if (token) sessionStorage.setItem('brass_token', token);
  } catch {}
}

function clearSession() {
  try {
    sessionStorage.removeItem('brass_playerId');
    sessionStorage.removeItem('brass_roomId');
    sessionStorage.removeItem('brass_name');
    sessionStorage.removeItem('brass_token');
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('board-canvas');
  renderer = new BoardRenderer(canvas);
  ui = new GameUI();
  inputHandler = new InputHandler(renderer, ui, socket);
  lobby = new Lobby(socket);

  window.inputHandler = inputHandler;
  window.renderer = renderer;

  // === 預覽模式 ===
  // === 計分動畫 ===
  async function playScoringAnimation(state) {
    const anim = state.scoringAnimation;
    if (!anim) return;

    // 移除舊的計分 overlay（防疊加）
    const oldOverlay = document.getElementById('scoring-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'scoring-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:5000;display:flex;align-items:center;justify-content:center;flex-direction:column';

    const title = document.createElement('h2');
    title.style.cssText = 'color:#d4a843;font-size:2em;margin-bottom:20px;font-family:Cinzel,serif';
    title.textContent = anim.era === 'canal' ? '🚢 運河時代計分' : '🚂 鐵路時代最終計分';
    overlay.appendChild(title);

    const scoreBoard = document.createElement('div');
    scoreBoard.style.cssText = 'background:rgba(0,0,0,0.8);padding:30px;border-radius:16px;border:2px solid #d4a843;min-width:500px;max-height:70vh;overflow-y:auto';
    overlay.appendChild(scoreBoard);

    document.body.appendChild(overlay);
    await sleep(1000);

    // 每個玩家
    for (const pid of state.turnOrder) {
      const score = anim.scores[pid];
      if (!score) continue;
      const p = state.players[pid];
      const pidx = state.turnOrder.indexOf(pid);
      const col = PLAYER_COLORS[pidx];

      const playerDiv = document.createElement('div');
      playerDiv.style.cssText = 'margin-bottom:20px';

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:1.3em;font-weight:bold;color:' + col + ';margin-bottom:8px';
      nameEl.textContent = p.name;
      playerDiv.appendChild(nameEl);

      scoreBoard.appendChild(playerDiv);

      // 路線分 — 逐條亮起
      if (score.linkDetails && score.linkDetails.length > 0) {
        const linkTitle = document.createElement('div');
        linkTitle.style.cssText = 'font-size:0.9em;color:#aaa;margin-bottom:4px';
        linkTitle.textContent = '路線分數:';
        playerDiv.appendChild(linkTitle);

        let linkTotal = 0;
        for (const ld of score.linkDetails) {
          // 在地圖上高亮這條路線
          renderer.highlightedCities = [ld.from, ld.to];
          renderer.render(state);

          const linkEl = document.createElement('div');
          linkEl.style.cssText = 'display:inline-block;margin:2px 4px;padding:3px 8px;border-radius:4px;font-size:0.85em;background:rgba(255,255,255,0.1);opacity:0;transition:opacity 0.3s';
          linkEl.textContent = ld.from + '↔' + ld.to + ' +' + ld.vp;
          playerDiv.appendChild(linkEl);
          await sleep(200);
          linkEl.style.opacity = '1';
          linkTotal += ld.vp;
        }

        const linkSum = document.createElement('div');
        linkSum.style.cssText = 'font-weight:bold;color:#ffd700;margin-top:4px;font-size:1.1em;opacity:0;transition:opacity 0.5s';
        linkSum.textContent = '路線合計: +' + linkTotal + ' VP';
        playerDiv.appendChild(linkSum);
        await sleep(300);
        linkSum.style.opacity = '1';
        renderer.highlightedCities = [];
        renderer.render(state);
      }

      await sleep(400);

      // 產業分 — 逐個亮起
      if (score.industryDetails && score.industryDetails.length > 0) {
        const indTitle = document.createElement('div');
        indTitle.style.cssText = 'font-size:0.9em;color:#aaa;margin-bottom:4px;margin-top:8px';
        indTitle.textContent = '產業分數:';
        playerDiv.appendChild(indTitle);

        let indTotal = 0;
        for (const id of score.industryDetails) {
          renderer.highlightedCities = [id.location];
          renderer.render(state);

          const d = INDUSTRY_DISPLAY[id.type] || {};
          const indEl = document.createElement('div');
          indEl.style.cssText = 'display:inline-block;margin:2px 4px;padding:3px 8px;border-radius:4px;font-size:0.85em;background:' + (d.iconBg || '#555') + ';color:' + (d.textColor || '#fff') + ';opacity:0;transition:opacity 0.3s';
          indEl.textContent = (d.short || id.type) + ' Lv' + id.level + ' +' + id.vp;
          playerDiv.appendChild(indEl);
          await sleep(150);
          indEl.style.opacity = '1';
          indTotal += id.vp;
        }

        const indSum = document.createElement('div');
        indSum.style.cssText = 'font-weight:bold;color:#7dcea0;margin-top:4px;font-size:1.1em;opacity:0;transition:opacity 0.5s';
        indSum.textContent = '產業合計: +' + indTotal + ' VP';
        playerDiv.appendChild(indSum);
        await sleep(300);
        indSum.style.opacity = '1';
        renderer.highlightedCities = [];
        renderer.render(state);
      }

      // 玩家總分
      const totalEl = document.createElement('div');
      totalEl.style.cssText = 'font-size:1.3em;font-weight:900;color:' + col + ';margin-top:8px;opacity:0;transition:opacity 0.5s';
      totalEl.textContent = p.name + ' 本次得分: +' + score.total + ' VP (累計 ' + p.vp + ')';
      playerDiv.appendChild(totalEl);
      await sleep(500);
      totalEl.style.opacity = '1';
      await sleep(800);
    }

    // 關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'margin-top:20px;padding:12px 30px;font-size:16px;background:#d4a843;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:bold';
    closeBtn.textContent = '繼續';
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  window.startPreview = function() {
    document.getElementById('lobby-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'flex';

    // 建立假的遊戲狀態
    const fakeState = {
      era: 'canal', round: 1, currentPlayerId: 'preview',
      actionsRemaining: 2, turnOrder: ['preview','bot1','bot2','bot3'],
      gameOver: false, winner: null, deckCount: 40,
      board: {}, links: [], coalMarket: 13, ironMarket: 8,
      merchants: [
        {id:'merchant-shrewsbury',name:'Shrewsbury Market',active:true,accepts:['manufacturer'],tiles:[{type:'manufacturer',accepts:['manufacturer'],beer:1}],beer:1,bonusType:'vp',bonusAmount:4,bonusDesc:'+4 分',connectedTo:['coalbrookdale']},
        {id:'merchant-gloucester',name:'Gloucester',active:true,accepts:['cotton'],tiles:[{type:'cotton',accepts:['cotton'],beer:1}],beer:1,bonusType:'develop',bonusAmount:1,bonusDesc:'免費研發1個',connectedTo:['worcester']},
        {id:'merchant-oxford',name:'Oxford',active:true,accepts:['pottery'],tiles:[{type:'pottery',accepts:['pottery'],beer:1}],beer:1,bonusType:'income',bonusAmount:2,bonusDesc:'收入+2格',connectedTo:['birmingham','coventry']},
        {id:'merchant-warrington',name:'Warrington',active:true,accepts:['cotton','manufacturer'],tiles:[{type:'wild',accepts:['cotton','manufacturer','pottery'],beer:1}],beer:1,bonusType:'money',bonusAmount:5,bonusDesc:'+£5',connectedTo:['stoke-on-trent','stone']},
        {id:'merchant-nottingham',name:'Nottingham',active:true,accepts:['cotton'],tiles:[{type:'cotton',accepts:['cotton'],beer:1}],beer:1,bonusType:'vp',bonusAmount:3,bonusDesc:'+3 分',connectedTo:['derby','belper']}
      ],
      log: [{message:'=== 預覽模式 ==='},{message:'這是預覽，不是真的遊戲'},{message:'可以查看地圖、城市格子、商人等'}],
      players: {
        'preview': {id:'preview',name:'你',money:17,trackPos:10,incomeLevel:0,income:0,vp:0,handSize:8,
          tiles:{cotton:[{level:1,cost:12,coalCost:0,ironCost:0,income:5,vp:5,linkVP:1,sellBeer:1,eraMin:'canal',noDevelop:false}],
                 coal:[{level:1,cost:5,coalCost:0,ironCost:0,income:4,vp:1,linkVP:2,resourceAmount:2,eraMin:'canal',noDevelop:false}],
                 iron:[{level:1,cost:5,coalCost:1,ironCost:0,income:3,vp:3,linkVP:1,resourceAmount:4,eraMin:'canal',noDevelop:false}],
                 manufacturer:[{level:1,cost:8,coalCost:1,ironCost:0,income:5,vp:3,linkVP:2,sellBeer:1,eraMin:'canal',noDevelop:false}],
                 pottery:[{level:1,cost:17,coalCost:0,ironCost:1,income:5,vp:10,linkVP:1,sellBeer:1,eraMin:'canal',noDevelop:true}],
                 brewery:[{level:1,cost:5,coalCost:0,ironCost:1,income:4,vp:4,linkVP:2,resourceAmount:1,eraMin:'canal',noDevelop:false}]},
          actionsThisTurn:0,spentThisRound:0,isCurrentPlayer:true},
        'bot1': {id:'bot1',name:'Bot-A',money:17,trackPos:10,incomeLevel:0,income:0,vp:0,handSize:8,tiles:{},actionsThisTurn:0,spentThisRound:0,isCurrentPlayer:false},
        'bot2': {id:'bot2',name:'Bot-B',money:17,trackPos:10,incomeLevel:0,income:0,vp:0,handSize:8,tiles:{},actionsThisTurn:0,spentThisRound:0,isCurrentPlayer:false},
        'bot3': {id:'bot3',name:'Bot-C',money:17,trackPos:10,incomeLevel:0,income:0,vp:0,handSize:8,tiles:{},actionsThisTurn:0,spentThisRound:0,isCurrentPlayer:false}
      },
      myHand: [
        {type:'location',location:'birmingham',name:'Birmingham'},
        {type:'location',location:'coventry',name:'Coventry'},
        {type:'location',location:'derby',name:'Derby'},
        {type:'industry',industry:'cotton',name:'Cotton'},
        {type:'industry',industry:'coal',name:'Coal'},
        {type:'industry',industry:'iron',name:'Iron'},
        {type:'industry',industry:'manufacturer',name:'Manufacturer'},
        {type:'industry',industry:'brewery',name:'Brewery'}
      ],
      pendingBonus: null
    };

    // 用 fetch 取得真實的 board 資料（如果伺服器有開）
    // 否則用空板
    fetch('/api/public-url').then(() => {
      // 伺服器有開，但預覽不需要
    }).catch(() => {});

    // 建立空板
    for (const [cid, pos] of Object.entries(BOARD_CITIES)) {
      fakeState.board[cid] = { name: cid, slots: [] };
    }
    // 加入商人位置
    for (const mid of Object.keys(BOARD_MERCHANTS)) {
      fakeState.board[mid] = { name: mid, isMerchant: true, slots: [] };
    }

    ui.updateGameState(fakeState, 'preview');
    renderer.render(fakeState);
    requestAnimationFrame(resizeCanvas);
    ui.showInfo('預覽模式 — 查看地圖和UI，不是真的遊戲');
  };


  // === 嘗試重連（含 30 秒 timeout）===
  let _reconnectTimeout = null;
  const session = getStoredSession();
  if (session.playerId && session.roomId && session.token) {
    console.log('嘗試重連:', session.playerId, session.roomId);
    socket.emit('reconnect-attempt', {
      playerId: session.playerId,
      roomId: session.roomId,
      token: session.token
    });
    _reconnectTimeout = setTimeout(() => {
      _reconnectTimeout = null;
      console.log('重連逾時，顯示大廳');
      clearSession();
      ui.showInfo('重連逾時，請重新加入房間');
    }, 30000);
  }

  // 重連成功
  socket.on('reconnect-success', ({ playerId, roomId, name, token }) => {
    if (_reconnectTimeout) { clearTimeout(_reconnectTimeout); _reconnectTimeout = null; }
    console.log('重連成功:', name);
    saveSession(playerId, roomId, name, token);
    ui.showInfo('重新連線成功！');
  });

  // 重連失敗 → 顯示大廳
  socket.on('reconnect-failed', () => {
    if (_reconnectTimeout) { clearTimeout(_reconnectTimeout); _reconnectTimeout = null; }
    console.log('重連失敗，顯示大廳');
    clearSession();
  });

  // === 房間事件（保存 session）===
  socket.on('room-created', ({ roomId, playerId, token }) => {
    const name = document.getElementById('player-name').value.trim();
    saveSession(playerId, roomId, name, token);
  });

  socket.on('room-joined', ({ roomId, playerId, token }) => {
    if (playerId) {
      const name = document.getElementById('player-name').value.trim();
      saveSession(playerId, roomId, name, token);
    }
  });

  // === 時代轉換提示 ===
  function showEraTransition(oldEra, newEra, scores, players, turnOrder) {
    const ov = document.getElementById('era-transition-overlay');
    if (!ov) return;
    const icon = document.getElementById('era-transition-icon');
    const title = document.getElementById('era-transition-title');
    const scoresEl = document.getElementById('era-transition-scores');

    icon.textContent = newEra === 'rail' ? '🚂' : '🏆';
    title.textContent = newEra === 'rail' ? '運河時代結束 → 鐵路時代開始' : '遊戲結束';

    if (scores) {
      let html = '<div style="margin-top:12px;font-size:.95em">';
      for (const pid of turnOrder) {
        const s = scores[pid];
        if (!s) continue;
        const p = players[pid];
        const idx = turnOrder.indexOf(pid);
        const col = PLAYER_COLORS[idx] || '#fff';
        html += `<div style="color:${col};margin:4px 0"><b>${escHtml(p.name)}</b>：路線 +${s.linkVP} ★ | 產業 +${s.industryVP} ★</div>`;
      }
      html += '</div>';
      scoresEl.innerHTML = html;
    } else {
      scoresEl.innerHTML = '';
    }

    ov.style.display = 'flex';
    setTimeout(() => { ov.style.display = 'none'; }, 4000);
  }

  let _lastEra = null;

  // === 遊戲狀態更新 ===
  socket.on('game-state', (state) => {
    currentGameState = state;
    document.getElementById('lobby-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'flex';

    const myPid = getStoredSession().playerId || socket.id;

    // 時代轉換偵測
    if (_lastEra && _lastEra !== state.era && state.scoringAnimation) {
      showEraTransition(_lastEra, state.era, state.scoringAnimation.scores, state.players, state.turnOrder);
    }
    _lastEra = state.era;

    ui.updateGameState(state, myPid);
    inputHandler.setGameState(state);
    renderer.render(state);
    requestAnimationFrame(resizeCanvas);

    // 計分動畫
    if (state.scoringAnimation && !window._scoringPlayed) {
      window._scoringPlayed = true;
      playScoringAnimation(state);
      // 下次收到沒有 scoringAnimation 的狀態時重置
    }
    if (!state.scoringAnimation) window._scoringPlayed = false;

    // 只在「回合開始、第一個行動前」通知一次
    const isMyTurn = state.currentPlayerId === myPid && !state.gameOver;
    const myPlayer = state.players[myPid];
    const isFirstAction = myPlayer && myPlayer.actionsThisTurn === 0;
    if (isMyTurn && isFirstAction && !window._notifiedThisTurn) {
      notifyMyTurn(state);
      window._notifiedThisTurn = true;
    }
    if (!isMyTurn) {
      window._notifiedThisTurn = false;
    }

    // 自動跳過模式
    if (window._autoPass && isMyTurn && myPlayer && myPlayer.handSize > 0) {
      setTimeout(() => socket.emit('pass-action', { cardIndex: 0 }), 300);
    }
    // 更新按鈕外觀
    const apBtn = document.getElementById('btn-auto-pass');
    if (apBtn) {
      apBtn.textContent = window._autoPass ? '⚡ 自動跳過中（點擊停止）' : '⚡ 持續自動跳過';
      apBtn.style.background = window._autoPass ? 'rgba(233,69,96,0.4)' : 'rgba(233,69,96,0.15)';
    }

    // 檢查是否有待處理的免費研發獎勵
    if (state.pendingBonus && state.pendingBonus.type === 'free-develop') {
      showFreeDevelopPopup(state, myPid);
    }

    // 恢復研發動作中途的狀態（防止刷新後遺失第一步選擇）
    if (isMyTurn && !ui.selectedAction) {
      try {
        const savedDevelop = sessionStorage.getItem('brass_pendingDevelop');
        if (savedDevelop) {
          const { developTypes, cardIndex } = JSON.parse(savedDevelop);
          if (developTypes && developTypes.length > 0 && state.myHand && state.myHand[cardIndex]) {
            ui.selectedAction = 'develop';
            ui.selectedCardIndex = cardIndex;
            ui.actionState = { developTypes };
            const player = state.players[myPid];
            if (player) {
              inputHandler._showDevelopSelection(
                player,
                '要再研發第 2 個嗎？（再消耗鐵×1，或選「完成」只研發 1 個）',
                false
              );
            }
          } else {
            sessionStorage.removeItem('brass_pendingDevelop');
          }
        }
      } catch { sessionStorage.removeItem('brass_pendingDevelop'); }
    }
  });

  // === 瀏覽器通知 ===
  let notificationPermission = 'default';
  try {
    notificationPermission = Notification.permission;
  } catch(e) {}

  // 主動請求通知權限（需要用戶互動觸發）
  function requestNotificationPermission() {
    if (notificationPermission !== 'granted' && notificationPermission !== 'denied') {
      try {
        Notification.requestPermission().then(p => {
          notificationPermission = p;
          console.log('通知權限:', p);
        });
      } catch(e) {}
    }
  }
  // 在任何點擊時請求權限
  document.addEventListener('click', function reqPerm() {
    requestNotificationPermission();
    document.removeEventListener('click', reqPerm);
  }, { once: true });

  // 自動跳過按鈕
  window._autoPass = false;
  const autoPassBtn = document.getElementById('btn-auto-pass');
  if (autoPassBtn) {
    autoPassBtn.addEventListener('click', () => {
      window._autoPass = !window._autoPass;
      if (window._autoPass) {
        ui.showInfo('自動跳過已啟用，輪到你時會自動棄牌跳過');
        // 如果現在就是你的回合，立刻跳
        if (currentGameState) {
          const myPid = getStoredSession().playerId || socket.id;
          const isMyTurn = currentGameState.currentPlayerId === myPid;
          if (isMyTurn) socket.emit('pass-action', { cardIndex: 0 });
        }
      } else {
        ui.showInfo('自動跳過已停止');
      }
    });
  }

  // 共用 AudioContext（避免每次通知都新建）
  let _sharedAudioCtx = null;
  function getAudioCtx() {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === 'suspended') _sharedAudioCtx.resume();
    return _sharedAudioCtx;
  }

  // 標題閃爍 interval ID（防疊加）
  let _blinkInterval = null;
  let _blinkStopTimer = null;

  function notifyMyTurn(state) {
    // 音效提示
    try {
      const audioCtx = getAudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = 660; gain.gain.value = 0.15;
      osc.start(); osc.stop(audioCtx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.frequency.value = 880; gain2.gain.value = 0.15;
        osc2.start(); osc2.stop(audioCtx.currentTime + 0.2);
      }, 150);
    } catch (e) {}

    // 標題閃爍（先清除舊的，防止疊加）
    if (_blinkInterval) clearInterval(_blinkInterval);
    if (_blinkStopTimer) clearTimeout(_blinkStopTimer);

    const originalTitle = document.title;
    let blink = true;
    _blinkInterval = setInterval(() => {
      document.title = blink ? '🔔 輪到你了！' : originalTitle;
      blink = !blink;
    }, 800);
    // 回到此頁面時停止閃爍
    const stopBlink = () => {
      if (_blinkInterval) { clearInterval(_blinkInterval); _blinkInterval = null; }
      if (_blinkStopTimer) { clearTimeout(_blinkStopTimer); _blinkStopTimer = null; }
      document.title = originalTitle;
      window.removeEventListener('focus', stopBlink);
    };
    window.addEventListener('focus', stopBlink);
    // 10秒後自動停止
    _blinkStopTimer = setTimeout(stopBlink, 10000);

    // 瀏覽器推播通知（不管頁面是否隱藏都嘗試發送）
    try {
      if (notificationPermission === 'granted') {
        const actionsLeft = state.actionsRemaining || 0;
        const n = new Notification('工業革命：伯明翰', {
          body: `輪到你了！剩餘 ${actionsLeft} 個行動`,
          icon: '/img/board.jpg',
          tag: 'brass-turn-' + Date.now(),
          requireInteraction: true
        });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 15000);
      } else if (notificationPermission === 'default') {
        // 還沒授權，再試一次
        requestNotificationPermission();
      }
    } catch(e) { console.log('通知失敗:', e); }
  }

  function showFreeDevelopPopup(state, myPid) {
    const player = state.players[myPid];
    if (!player) return;

    const options = [];
    for (const [type, tiles] of Object.entries(player.tiles)) {
      if (tiles.length === 0) continue;
      // 陶瓷燈泡不能研發
      if (tiles[0].noDevelop) continue;
      const d = INDUSTRY_DISPLAY[type];
      const levelCounts = {};
      for (const t of tiles) {
        levelCounts[t.level] = (levelCounts[t.level] || 0) + 1;
      }
      const levelStr = Object.entries(levelCounts).map(([lv, cnt]) => `Lv${lv}\u00D7${cnt}`).join(' ');
      options.push({
        label: `${d.label} — 移除 Lv${tiles[0].level}（剩餘：${levelStr}）`,
        value: type
      });
    }

    ui.showSelection(
      `\u{1F37A} 商人啤酒獎勵：免費研發 1 個產業（不用鐵）`,
      options,
      (industryType) => {
        socket.emit('free-develop', { industryType });
      }
    );
  }

  socket.on('action-error', (msg) => {
    ui.showError(msg);
  });

  // 聊天
  socket.on('chat', ({ from, message }) => {
    if (!currentGameState) return;
    currentGameState.log.push({ message: `[${from}] ${message}` });
    ui.updateLog(currentGameState);
  });

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && chatInput.value.trim()) {
        socket.emit('chat', chatInput.value.trim());
        chatInput.value = '';
      }
    });
  }

  // 返回大廳
  document.getElementById('btn-back-lobby').addEventListener('click', () => {
    document.getElementById('game-over-overlay').style.display = 'none';
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('lobby-view').style.display = 'flex';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('room-section').style.display = 'none';
    clearSession();
    // 釋放 AudioContext 資源
    if (_sharedAudioCtx && _sharedAudioCtx.state !== 'closed') {
      _sharedAudioCtx.close().catch(() => {});
      _sharedAudioCtx = null;
    }
  });

  // Resize
  function resizeCanvas() {
    const container = document.getElementById('board-container');
    if (container && canvas) {
      // 等比例填滿容器（不變形）
      const cw = container.clientWidth - 4;
      const ch = container.clientHeight - 4;
      const size = Math.min(cw, ch); // 取較小邊，確保 canvas 不超出容器
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';

      // HiDPI 支援：提高 canvas 內部解析度
      const dpr = window.devicePixelRatio || 1;
      const internalSize = 1000 * dpr;
      if (canvas.width !== internalSize) {
        canvas.width = internalSize;
        canvas.height = internalSize;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 需要重繪
        if (currentGameState && renderer) renderer.render(currentGameState);
      }
    }
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 150);
});
