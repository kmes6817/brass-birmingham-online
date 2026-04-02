const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const GameManager = require('./server/GameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const gm = new GameManager();

app.use(express.static('public'));

let publicUrl = null;

app.get('/api/public-url', (req, res) => {
  res.json({ url: publicUrl });
});

// === 玩家 ID 映射（斷線重連用）===
// playerId (persistent) → { socketId, roomId, name, token }
const playerMap = new Map();

function genPlayerId() {
  return crypto.randomBytes(8).toString('hex');
}

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

function sanitizeName(name) {
  return String(name || 'Player').replace(/[<>&"']/g, '').trim().slice(0, 20) || 'Player';
}

// 透過 playerId 找到對應的 socketId，用來發送訊息
function getSocketId(playerId) {
  const info = playerMap.get(playerId);
  return info ? info.socketId : null;
}

// === 每個 socket 的速率限制器 ===
// limits: { eventName: { max, windowMs } }
function makeRateLimiter(limits) {
  // counters: Map<eventName, { count, resetAt }>
  const counters = new Map();
  return function check(event) {
    const rule = limits[event];
    if (!rule) return true; // 無規則 → 放行
    const now = Date.now();
    let entry = counters.get(event);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + rule.windowMs };
      counters.set(event, entry);
    }
    entry.count++;
    return entry.count <= rule.max;
  };
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  let playerId = null;
  let currentRoom = null;
  let playerName = null;

  // 每個連線獨立的速率限制
  const rateLimit = makeRateLimiter({
    'game-action':  { max: 20, windowMs: 1000 },
    'pass-action':  { max: 10, windowMs: 1000 },
    'chat':         { max: 5,  windowMs: 3000 },
  });

  // === 斷線重連 ===
  socket.on('reconnect-attempt', (data) => {
    if (!data || typeof data !== 'object') { socket.emit('reconnect-failed'); return; }
    const { playerId: pid, roomId: rid, token: tok } = data;

    const info = playerMap.get(pid);
    if (!info) { socket.emit('reconnect-failed'); return; }

    // 驗證 reconnect token
    if (!tok || tok !== info.token) { socket.emit('reconnect-failed'); return; }

    const room = gm.getRoom(rid || info.roomId);
    if (!room) { socket.emit('reconnect-failed'); return; }

    // 找到這個玩家在房間裡的記錄
    const playerInRoom = room.players.find(p => p.id === pid);
    if (!playerInRoom) { socket.emit('reconnect-failed'); return; }

    // 重新映射 socket
    playerId = pid;
    currentRoom = room.id;
    playerName = playerInRoom.name;
    info.socketId = socket.id;
    playerInRoom.connected = true;

    // 取消房間清理計時器
    if (room._cleanupTimer) {
      clearTimeout(room._cleanupTimer);
      delete room._cleanupTimer;
    }

    socket.join(currentRoom);
    console.log(`Reconnected: ${playerName} (${pid}) → socket ${socket.id}`);

    // 推送最新狀態
    if (room.game) {
      const state = room.game.getStateForPlayer(playerId);
      socket.emit('game-state', state);
    } else {
      socket.emit('room-joined', { roomId: currentRoom });
      socket.emit('room-update', getRoomData(currentRoom));
    }

    socket.emit('reconnect-success', { playerId, roomId: currentRoom, name: playerName, token: info.token });
  });

  // === 建立房間 ===
  socket.on('create-room', (data) => {
    if (!data) return;
    const name = sanitizeName(typeof data === 'string' ? data : data.name);
    // 永遠由伺服器生成 playerId，不信任客戶端
    const pid = genPlayerId();
    const token = genToken();

    playerName = name;
    playerId = pid;
    const roomId = gm.createRoom(playerId, playerName);
    currentRoom = roomId;

    playerMap.set(playerId, { socketId: socket.id, roomId, name: playerName, token });

    // 標記連線狀態
    const room = gm.getRoom(roomId);
    const p = room.players.find(p => p.id === playerId);
    if (p) p.connected = true;

    socket.join(roomId);
    socket.emit('room-created', { roomId, playerId, token });
    socket.emit('room-update', getRoomData(roomId));
  });

  // === 加入房間 ===
  socket.on('join-room', (data) => {
    if (!data || typeof data !== 'object') return;
    const roomId = (data.roomId || '').toUpperCase();
    const name = sanitizeName(data.name);
    // 永遠由伺服器生成 playerId，不信任客戶端
    const pid = genPlayerId();
    const token = genToken();

    playerName = name;
    playerId = pid;

    const result = gm.joinRoom(roomId, playerId, playerName);
    if (result.success) {
      currentRoom = roomId;
      playerMap.set(playerId, { socketId: socket.id, roomId, name: playerName, token });

      const room = gm.getRoom(roomId);
      const p = room.players.find(p => p.id === playerId);
      if (p) p.connected = true;

      socket.join(currentRoom);
      socket.emit('room-joined', { roomId: currentRoom, playerId, token });
      io.to(currentRoom).emit('room-update', getRoomData(currentRoom));
    } else {
      socket.emit('error-msg', result.reason);
    }
  });

  // === 準備 ===
  socket.on('toggle-ready', () => {
    if (!currentRoom || !playerId) return;
    gm.toggleReady(currentRoom, playerId);
    io.to(currentRoom).emit('room-update', getRoomData(currentRoom));
  });

  // === 開始遊戲 ===
  socket.on('start-game', () => {
    if (!currentRoom) return;
    const result = gm.startGame(currentRoom);
    if (result.success) {
      broadcastGameState(currentRoom);
    } else {
      socket.emit('error-msg', result.reason);
    }
  });

  // === 遊戲行動 ===
  socket.on('game-action', (data) => {
    if (!rateLimit('game-action')) { socket.emit('action-error', '操作過於頻繁，請稍後再試'); return; }
    if (!data || typeof data !== 'object') return;
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

    const { actionType, params } = data;
    if (typeof actionType !== 'string') return;

    const result = room.game.executeAction(playerId, actionType, params || {});
    if (result.success) {
      broadcastGameState(currentRoom);
    } else {
      socket.emit('action-error', result.reason);
    }
  });

  // === 跳過 ===
  socket.on('pass-action', (data) => {
    if (!rateLimit('pass-action')) { socket.emit('action-error', '操作過於頻繁，請稍後再試'); return; }
    if (!data || typeof data !== 'object') return;
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

    const cardIndex = typeof data.cardIndex === 'number' ? Math.trunc(data.cardIndex) : undefined;
    const result = room.game.executePass(playerId, cardIndex);
    if (result.success) {
      broadcastGameState(currentRoom);
    } else {
      socket.emit('action-error', result.reason);
    }
  });

  // === 免費研發獎勵選擇 ===
  socket.on('free-develop', (data) => {
    if (!data || typeof data !== 'object') return;
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

    const { industryType } = data;
    if (typeof industryType !== 'string') return;

    const result = room.game.executeFreeDevelop(playerId, industryType);
    if (result.success) {
      // 清除 pending bonus
      if (room.game.pendingBonus) delete room.game.pendingBonus[playerId];
      broadcastGameState(currentRoom);
    } else {
      socket.emit('action-error', result.reason);
    }
  });

  // === 聊天 ===
  socket.on('chat', (message) => {
    if (!rateLimit('chat')) return; // 超速：靜默丟棄
    if (!currentRoom) return;
    if (typeof message !== 'string') return;
    const sanitized = message.slice(0, 500).replace(/[<>]/g, '').trim();
    if (!sanitized) return; // 防止純空白訊息
    io.to(currentRoom).emit('chat', { from: (playerName || 'Player').slice(0, 50), message: sanitized });
  });

  socket.on('get-rooms', () => {
    socket.emit('room-list', gm.getRoomList());
  });

  // === 斷線（不移除玩家，等重連）===
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id} (player: ${playerId})`);
    if (playerId && currentRoom) {
      const room = gm.getRoom(currentRoom);
      if (room) {
        const p = room.players.find(p => p.id === playerId);
        if (p) p.connected = false;

        const allDisconnected = room.players.every(p => !p.connected);

        if (allDisconnected) {
          if (!room.started) {
            // 遊戲還沒開始，立即清除
            console.log(`Room ${currentRoom} empty (not started), removing`);
            cleanupRoom(currentRoom);
          } else {
            // 遊戲已開始，10 分鐘後清除（給重連機會）
            console.log(`Room ${currentRoom} all disconnected, will cleanup in 10 min`);
            room._cleanupTimer = setTimeout(() => {
              const r = gm.getRoom(currentRoom);
              if (r && r.players.every(p => !p.connected)) {
                console.log(`Room ${currentRoom} cleanup after timeout`);
                cleanupRoom(currentRoom);
              }
            }, 10 * 60 * 1000);
          }
        } else {
          io.to(currentRoom).emit('room-update', getRoomData(currentRoom));
        }
      }
    }
  });
});

function cleanupRoom(roomId) {
  const room = gm.getRoom(roomId);
  if (room) {
    if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
    // 清除所有玩家的 playerMap 條目
    for (const p of room.players) {
      playerMap.delete(p.id);
    }
  }
  gm.rooms.delete(roomId);
}

function getRoomData(roomId) {
  const room = gm.getRoom(roomId);
  if (!room) return null;
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      connected: p.connected !== false
    })),
    started: room.started,
    canStart: gm.canStart(roomId)
  };
}

function broadcastGameState(roomId) {
  const room = gm.getRoom(roomId);
  if (!room || !room.game) return;
  // 先建立共用狀態（一次），再為每個玩家覆蓋私有欄位
  const shared = room.game.getSharedState();
  for (const player of room.players) {
    const socketId = getSocketId(player.id);
    if (socketId) {
      const state = room.game.getStateForPlayer(player.id, shared);
      io.to(socketId).emit('game-state', state);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log('');
  console.log('  ============================================');
  console.log('  |   Brass: Birmingham Online Server        |');
  console.log('  ============================================');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}`);

  try {
    const { spawn } = require('child_process');
    const cfBin = require('cloudflared').bin;
    const cfChild = spawn(cfBin, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let found = false;
    const parseUrl = (data) => {
      const match = data.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !found) {
        found = true;
        publicUrl = match[0];
        console.log(`  Public:  ${publicUrl}`);
        console.log('');
        console.log('  \u2714 Share this URL with friends!');
        console.log('  ============================================');
      }
    };
    cfChild.stdout.on('data', parseUrl);
    cfChild.stderr.on('data', parseUrl);
    process.on('SIGINT', () => { cfChild.kill(); process.exit(); });
    process.on('SIGTERM', () => { cfChild.kill(); process.exit(); });
  } catch (e) {
    console.log('  [tunnel] Could not start:', e.message);
    console.log('  ============================================');
  }

  // Graceful shutdown：記錄錯誤後由 process manager（PM2 等）負責重啟
  process.on('uncaughtException', (err) => {
    console.error('  [fatal] uncaughtException:', err);
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 3000).unref(); // 3 秒後強制退出
  });
  process.on('unhandledRejection', (reason) => {
    console.error('  [fatal] unhandledRejection:', reason);
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 3000).unref();
  });
});
