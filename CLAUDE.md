# CLAUDE.md

## Project Overview

Brass: Birmingham Online — a real-time multiplayer web implementation of the board game Brass: Birmingham. 2-4 players, full rule set, two eras (canal + rail).

## Tech Stack

- **Backend:** Node.js + Express + Socket.io
- **Frontend:** Vanilla JS, Canvas-based rendering, no framework
- **Tunneling:** Cloudflare Tunnel (primary), ngrok/localtunnel (fallback)
- **Module system:** CommonJS (`require`/`module.exports`)

## Commands

- `npm install` — install dependencies
- `npm start` — start server (Express + Socket.io on port 3000, auto-creates Cloudflare tunnel)
- `node test-ai-players.js [port]` — launch 4 AI players for testing

## Project Structure

```
server.js                 # Entry point: Express + Socket.io setup
server/
  BrassGame.js            # Core game state machine
  GameManager.js          # Room & player session management
  actions.js              # 6 action types (build, network, develop, sell, loan, scout)
  market.js               # Coal/iron market logic
  scoring.js              # VP calculation, era transitions, turn order
  cards.js                # Deck management & dealing
  data/
    board.js              # 27 locations, 55 connections, merchant tiles
    constants.js          # Income track, market prices, game rules
    industries.js         # 6 industry types with level variants
public/
  index.html              # Main game page
  js/
    main.js               # Socket.io client, game loop, reconnection
    renderer.js           # Canvas board rendering (BoardRenderer class)
    ui.js                 # HUD, panels, buttons
    input.js              # Mouse/keyboard interaction
    lobby.js              # Room creation/joining UI
    boardData.js          # City coordinates & slot positions
    routeData.js          # Route visual definitions
  calibrate.html          # City position calibration tool
  calibrate-slots.html    # Industry slot calibration tool
  calibrate-routes.html   # Route calibration tool
```

## Code Conventions

- UI text, logs, and comments are in **Traditional Chinese**
- Action handlers return `{ success: boolean, reason?: string, message?: string }`
- Game state is broadcast to all clients on every state change via Socket.io
- Session persistence via `sessionStorage` (client) and server-side player map
- No test framework; use `test-ai-players.js` for integration testing
- No build step or transpilation — raw JS served directly

## Key Architecture Notes

- `BrassGame` is the single source of truth for game state
- All validation happens server-side before state mutation
- Client receives full game state and re-renders on each update
- Canvas renders at 2000x2000px with zoom/pan support
- Socket.io events: `create-room`, `join-room`, `game-action`, `reconnect-attempt`, etc.
