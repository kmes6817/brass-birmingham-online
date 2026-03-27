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
      name: sessionStorage.getItem('brass_name')
    };
  } catch { return {}; }
}

function saveSession(playerId, roomId, name) {
  try {
    if (playerId) sessionStorage.setItem('brass_playerId', playerId);
    if (roomId) sessionStorage.setItem('brass_roomId', roomId);
    if (name) sessionStorage.setItem('brass_name', name);
  } catch {}
}

function clearSession() {
  try {
    sessionStorage.removeItem('brass_playerId');
    sessionStorage.removeItem('brass_roomId');
    sessionStorage.removeItem('brass_name');
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

  // === 嘗試重連 ===
  const session = getStoredSession();
  if (session.playerId && session.roomId) {
    console.log('嘗試重連:', session.playerId, session.roomId);
    socket.emit('reconnect-attempt', {
      playerId: session.playerId,
      roomId: session.roomId
    });
  }

  // 重連成功
  socket.on('reconnect-success', ({ playerId, roomId, name }) => {
    console.log('重連成功:', name);
    saveSession(playerId, roomId, name);
    ui.showInfo('重新連線成功！');
  });

  // 重連失敗 → 顯示大廳
  socket.on('reconnect-failed', () => {
    console.log('重連失敗，顯示大廳');
    clearSession();
  });

  // === 房間事件（保存 session）===
  socket.on('room-created', ({ roomId, playerId }) => {
    const name = document.getElementById('player-name').value.trim();
    saveSession(playerId, roomId, name);
  });

  socket.on('room-joined', ({ roomId, playerId }) => {
    if (playerId) {
      const name = document.getElementById('player-name').value.trim();
      saveSession(playerId, roomId, name);
    }
  });

  // === 遊戲狀態更新 ===
  socket.on('game-state', (state) => {
    currentGameState = state;
    document.getElementById('lobby-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'flex';

    const myPid = getStoredSession().playerId || socket.id;
    // DEBUG: 追蹤市場值
    if (window._lastIron !== undefined && window._lastIron !== state.ironMarket) {
      console.log('鐵市場變化:', window._lastIron, '→', state.ironMarket);
    }
    window._lastIron = state.ironMarket;
    window._lastCoal = state.coalMarket;
    ui.updateGameState(state, myPid);
    inputHandler.setGameState(state);
    renderer.render(state);
    requestAnimationFrame(resizeCanvas);

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

  function notifyMyTurn(state) {
    // 音效提示
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

    // 標題閃爍
    const originalTitle = document.title;
    let blink = true;
    const blinkInterval = setInterval(() => {
      document.title = blink ? '🔔 輪到你了！' : originalTitle;
      blink = !blink;
    }, 800);
    // 回到此頁面時停止閃爍
    const stopBlink = () => {
      clearInterval(blinkInterval);
      document.title = originalTitle;
      window.removeEventListener('focus', stopBlink);
    };
    window.addEventListener('focus', stopBlink);
    // 5秒後自動停止
    setTimeout(stopBlink, 10000);

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
  });

  // Resize
  function resizeCanvas() {
    const container = document.getElementById('board-container');
    if (container && canvas) {
      // 等比例填滿容器（不變形）
      const cw = container.clientWidth - 4;
      const ch = container.clientHeight - 4;
      const size = Math.max(cw, ch); // 取較大邊，讓地圖可以大一點
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    }
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 150);
});
