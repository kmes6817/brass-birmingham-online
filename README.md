# 🏭 工業革命：伯明翰 線上版

**Brass: Birmingham Online** — 經典桌遊的線上多人即時對戰版本

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-blue)
![Players](https://img.shields.io/badge/Players-2~4-orange)

## 功能

- 🎮 **2-4人即時線上對戰**
- 🚢 **完整兩個時代**：運河時代 + 鐵路時代
- 🏗️ **6種行動**：建造 / 建路 / 研發 / 販賣 / 貸款 / 偵查
- 🏭 **6種產業**：棉花 / 煤礦 / 鐵廠 / 工廠 / 陶瓷 / 啤酒廠
- 📊 **變速收入軌道**（101格）
- 📈 **煤/鐵市場**雙向流通
- 🎲 **商人隨機板塊** + 啤酒獎勵
- 🌾 **農莊啤酒廠**
- 🗺️ **實際遊戲板底圖** + 縮放平移
- 🌐 **Cloudflare Tunnel** 公開連線（免費、免註冊）
- 🔄 **斷線重連**
- 🔔 **回合通知**（瀏覽器推播 + 音效）
- 🎨 **卡牌圖片支援**

## 快速開始

```bash
# 安裝
git clone https://github.com/kmes6817/brass-birmingham-online.git
cd brass-birmingham-online
npm install

# 啟動（自動產生公開連結）
npm start
```

啟動後會顯示：
```
Local:   http://localhost:3000
Public:  https://xxx-xxx.trycloudflare.com
```

把 Public 連結分享給朋友就能一起玩！

## 遊戲截圖

啟動後打開 `http://localhost:3000`

## 校正工具

- `/calibrate.html` — 城市位置校正（拖拽對齊底圖）
- `/calibrate-slots.html` — 產業格子校正（每格獨立調整）

## 技術架構

```
├── server.js              # Express + Socket.io 入口
├── server/
│   ├── BrassGame.js       # 遊戲狀態機
│   ├── GameManager.js     # 房間管理
│   ├── actions.js         # 6種行動邏輯
│   ├── market.js          # 煤/鐵市場 + 資源消耗
│   ├── scoring.js         # 計分 + 行動順序
│   ├── cards.js           # 牌組管理
│   └── data/
│       ├── board.js       # 地圖城市 + 路線
│       ├── constants.js   # 收入軌 + 市場價格
│       └── industries.js  # 產業板塊數據
├── public/
│   ├── index.html         # 遊戲頁面
│   ├── css/style.css      # 樣式
│   ├── js/
│   │   ├── main.js        # 入口 + 重連 + 通知
│   │   ├── renderer.js    # Canvas 渲染
│   │   ├── ui.js          # UI 管理
│   │   ├── input.js       # 輸入處理
│   │   ├── lobby.js       # 大廳
│   │   └── boardData.js   # 地圖座標
│   └── img/
│       ├── board-hd.jpg   # 遊戲板底圖
│       └── cards/         # 卡牌圖片
└── CHANGELOG.md           # 版本紀錄
```

## 授權

本專案為個人學習用途，Brass: Birmingham 桌遊版權歸 Roxley Games 所有。
