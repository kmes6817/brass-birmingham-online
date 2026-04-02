// Game room management for Brass: Birmingham

const BrassGame = require('./BrassGame');

class GameManager {
  constructor() {
    this.rooms = new Map(); // roomId -> { players, game, started }
  }

  createRoom(hostId, hostName) {
    const roomId = this.generateRoomId();
    this.rooms.set(roomId, {
      id: roomId,
      players: [{ id: hostId, name: hostName, ready: false }],
      game: null,
      started: false
    });
    return roomId;
  }

  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, reason: 'Room not found' };
    if (room.started) return { success: false, reason: 'Game already started' };
    if (room.players.length >= 4) return { success: false, reason: 'Room is full' };
    if (room.players.find(p => p.id === playerId)) {
      return { success: true, reason: 'Already in room' };
    }

    room.players.push({ id: playerId, name: playerName, ready: false });
    return { success: true };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  toggleReady(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.ready = !player.ready;
      return player.ready;
    }
    return false;
  }

  canStart(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.players.length < 2) return false;
    return room.players.every(p => p.ready);
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, reason: 'Room not found' };
    if (!this.canStart(roomId)) {
      return { success: false, reason: 'Not all players ready (need at least 2)' };
    }

    const playerInfos = room.players.map(p => ({ id: p.id, name: p.name }));
    room.game = new BrassGame(playerInfos);
    room.started = true;

    return { success: true };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomByPlayer(playerId) {
    for (const [roomId, room] of this.rooms) {
      if (room.players.find(p => p.id === playerId)) {
        return { roomId, room };
      }
    }
    return null;
  }

  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id;
    do {
      id = '';
      for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(id));
    return id;
  }

  getRoomList() {
    const list = [];
    for (const [id, room] of this.rooms) {
      if (!room.started) {
        list.push({
          id,
          playerCount: room.players.length,
          players: room.players.map(p => p.name)
        });
      }
    }
    return list;
  }
}

module.exports = GameManager;
