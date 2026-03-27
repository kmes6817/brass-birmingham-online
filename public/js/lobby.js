// 大廳管理 - 工業革命：伯明翰（全中文版）

class Lobby {
  constructor(socket) {
    this.socket = socket;
    this.setupEvents();
    this.setupSocketListeners();
    this.fetchPublicUrl();
  }

  fetchPublicUrl() {
    fetch('/api/public-url')
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          this.publicUrl = data.url;
          const disp = document.getElementById('public-url-display');
          disp.style.display = 'block';
          const box = document.getElementById('public-url-text');
          box.textContent = data.url;
          box.title = '點擊複製';
          box.addEventListener('click', () => {
            navigator.clipboard.writeText(data.url).then(() => {
              box.textContent = '已複製！';
              setTimeout(() => { box.textContent = data.url; }, 1200);
            });
          });
        }
      })
      .catch(() => {});
  }

  setupEvents() {
    document.getElementById('btn-create').addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      if (!name) { this.showError('請輸入你的名字！'); return; }
      this.socket.emit('create-room', { name, playerId: sessionStorage.getItem('brass_playerId') || undefined });
    });

    document.getElementById('btn-join-toggle').addEventListener('click', () => {
      const s = document.getElementById('join-section');
      s.style.display = s.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('btn-join').addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      const code = document.getElementById('room-code').value.trim();
      if (!name) { this.showError('請輸入你的名字！'); return; }
      if (!code) { this.showError('請輸入房間代碼！'); return; }
      this.socket.emit('join-room', { roomId: code, name, playerId: sessionStorage.getItem('brass_playerId') || undefined });
    });

    // Enter 鍵支援
    document.getElementById('player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-create').click();
    });
    document.getElementById('room-code').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });

    document.getElementById('btn-ready').addEventListener('click', () => {
      this.socket.emit('toggle-ready');
    });

    document.getElementById('btn-start').addEventListener('click', () => {
      this.socket.emit('start-game');
    });
  }

  setupSocketListeners() {
    this.socket.on('room-created', ({ roomId }) => {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('room-section').style.display = 'block';
      document.getElementById('room-id').textContent = roomId;
      if (this.publicUrl) {
        const el = document.getElementById('room-public-url');
        el.style.display = 'block';
        el.textContent = this.publicUrl;
        el.title = '點擊複製';
        el.addEventListener('click', () => {
          navigator.clipboard.writeText(this.publicUrl).then(() => {
            el.textContent = '已複製！';
            setTimeout(() => { el.textContent = this.publicUrl; }, 1200);
          });
        });
      }
    });

    this.socket.on('room-joined', ({ roomId }) => {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('room-section').style.display = 'block';
      document.getElementById('room-id').textContent = roomId;
    });

    this.socket.on('room-update', (data) => {
      if (!data) return;
      this.updatePlayerList(data);
    });

    this.socket.on('error-msg', (msg) => {
      this.showError(msg);
    });
  }

  updatePlayerList(data) {
    const c = document.getElementById('player-list');
    c.innerHTML = '';

    data.players.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'player-item';
      const col = PLAYER_COLORS[i] || '#888';
      d.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:${col}"></div>
          <span class="p-name">${p.name.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
        </div>
        <span class="ready-badge ${p.connected === false ? 'no' : p.ready ? 'yes' : 'no'}">${p.connected === false ? '\u26A0 離線' : p.ready ? '\u2713 已準備' : '等待中...'}</span>
      `;
      c.appendChild(d);
    });

    const storedPid = sessionStorage.getItem('brass_playerId');
    const me = data.players.find(p => p.id === storedPid || p.id === this.socket.id);
    const rb = document.getElementById('btn-ready');
    if (me && me.ready) {
      rb.classList.add('ready');
      rb.textContent = '取消準備';
    } else {
      rb.classList.remove('ready');
      rb.textContent = '準備';
    }
    document.getElementById('btn-start').disabled = !data.canStart;
  }

  showError(msg) {
    const el = document.getElementById('error-display');
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 3500);
  }
}
