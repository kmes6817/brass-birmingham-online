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
// playerId (persistent) → { socketId, roomId, name }
const playerMap = new Map();

function genPlayerId() {
  return crypto.randomBytes(8).toString('hex');
}

// 透過 playerId 找到對應的 socketId，用來發送訊息
function getSocketId(playerId) {
  const info = playerMap.get(playerId);
  return info ? info.socketId : null;
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  let playerId = null;
  let currentRoom = null;
  let playerName = null;

  // === 斷線重連 ===
  socket.on('reconnect-attempt', ({ playerId: pid, roomId: rid }) => {
    const info = playerMap.get(pid);
    if (!info) { socket.emit('reconnect-failed'); return; }

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

    socket.emit('reconnect-success', { playerId, roomId: currentRoom, name: playerName });
  });

  // === 建立房間 ===
  socket.on('create-room', (data) => {
    const name = (typeof data === 'string' ? data : data.name) || 'Player';
    const pid = (typeof data === 'object' && data.playerId) || genPlayerId();

    playerName = name;
    playerId = pid;
    const roomId = gm.createRoom(playerId, playerName);
    currentRoom = roomId;

    playerMap.set(playerId, { socketId: socket.id, roomId, name: playerName });

    // 標記連線狀態
    const room = gm.getRoom(roomId);
    const p = room.players.find(p => p.id === playerId);
    if (p) p.connected = true;

    socket.join(roomId);
    socket.emit('room-created', { roomId, playerId });
    socket.emit('room-update', getRoomData(roomId));
  });

  // === 加入房間 ===
  socket.on('join-room', (data) => {
    const roomId = (data.roomId || '').toUpperCase();
    const name = data.name || 'Player';
    const pid = data.playerId || genPlayerId();

    playerName = name;
    playerId = pid;

    const result = gm.joinRoom(roomId, playerId, playerName);
    if (result.success) {
      currentRoom = roomId;
      playerMap.set(playerId, { socketId: socket.id, roomId, name: playerName });

      const room = gm.getRoom(roomId);
      const p = room.players.find(p => p.id === playerId);
      if (p) p.connected = true;

      socket.join(currentRoom);
      socket.emit('room-joined', { roomId: currentRoom, playerId });
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
  socket.on('game-action', ({ actionType, params }) => {
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.executeAction(playerId, actionType, params);
    if (result.success) {
      broadcastGameState(currentRoom);
    } else {
      socket.emit('action-error', result.reason);
    }
  });

  // === 跳過 ===
  socket.on('pass-action', ({ cardIndex }) => {
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.executePass(playerId, cardIndex);
    if (result.success) {
      broadcastGameState(currentRoom);
    } else {
      socket.emit('action-error', result.reason);
    }
  });

  // === 免費研發獎勵選擇 ===
  socket.on('free-develop', ({ industryType }) => {
    if (!currentRoom || !playerId) return;
    const room = gm.getRoom(currentRoom);
    if (!room || !room.game) return;

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
    if (!currentRoom) return;
    io.to(currentRoom).emit('chat', { from: playerName, message });
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

        // 如果遊戲還沒開始且所有人都斷線了，才清房間
        if (!room.started && room.players.every(p => !p.connected)) {
          console.log(`Room ${currentRoom} empty, removing`);
          gm.rooms.delete(currentRoom);
        } else {
          io.to(currentRoom).emit('room-update', getRoomData(currentRoom));
        }
      }
    }
  });
});

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
  for (const player of room.players) {
    const socketId = getSocketId(player.id);
    if (socketId) {
      const state = room.game.getStateForPlayer(player.id);
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

  process.on('uncaughtException', (err) => { console.error('  [error]', err.message); });
  process.on('unhandledRejection', (err) => { console.error('  [error]', err); });
});
