// Scoring logic for Brass: Birmingham

const { getIncomeLevel } = require('./data/constants');

// Calculate VP for a single link
function scoreLinkVP(link, board) {
  let vp = 0;

  // Check both connected locations
  for (const locId of [link.from, link.to]) {
    const loc = board[locId];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.built && slot.built.flipped) {
        vp += (slot.built.linkVP || 1);
      }
    }
  }

  return vp;
}

// Score all links for a player
function scorePlayerLinks(gameState, playerId) {
  let totalVP = 0;
  for (const link of gameState.links) {
    if (link.owner === playerId) {
      totalVP += scoreLinkVP(link, gameState.board);
    }
  }
  return totalVP;
}

// Score all flipped industries for a player
function scorePlayerIndustries(gameState, playerId) {
  let totalVP = 0;
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built && slot.built.owner === playerId && slot.built.flipped) {
        totalVP += slot.built.vp;
      }
    }
  }
  return totalVP;
}

// End of Canal Era scoring and cleanup
function scoreCanalEra(gameState) {
  const scores = {};

  for (const playerId of Object.keys(gameState.players)) {
    const linkVP = scorePlayerLinks(gameState, playerId);
    const industryVP = scorePlayerIndustries(gameState, playerId);
    scores[playerId] = { linkVP, industryVP, total: linkVP + industryVP };
    gameState.players[playerId].vp += linkVP + industryVP;
  }

  // Income phase: each player gets income based on their income level
  for (const playerId of Object.keys(gameState.players)) {
    const player = gameState.players[playerId];
    const income = getIncomeLevel(player.trackPos);
    player.money += income;
    if (player.money < 0) player.money = 0;
  }

  // Remove all canal-era links
  gameState.links = gameState.links.filter(l => l.type !== 'canal');

  // Remove all level-1 industry tiles from board
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built && slot.built.level === 1) {
        slot.built = null;
      }
    }
  }

  return scores;
}

// End of Rail Era scoring (final scoring)
function scoreRailEra(gameState) {
  const scores = {};

  for (const playerId of Object.keys(gameState.players)) {
    const linkVP = scorePlayerLinks(gameState, playerId);
    const industryVP = scorePlayerIndustries(gameState, playerId);
    scores[playerId] = { linkVP, industryVP, total: linkVP + industryVP };
    gameState.players[playerId].vp += linkVP + industryVP;
  }

  // Determine winner
  let winner = null;
  let maxVP = -1;
  for (const [playerId, player] of Object.entries(gameState.players)) {
    if (player.vp > maxVP) {
      maxVP = player.vp;
      winner = playerId;
    } else if (player.vp === maxVP) {
      // Tiebreak: most money
      if (player.money > gameState.players[winner].money) {
        winner = playerId;
      }
    }
  }

  return { scores, winner };
}

// Determine turn order (本輪花費最少的先行動，平手維持原順序)
function calculateTurnOrder(gameState) {
  const players = Object.entries(gameState.players).map(([id, p]) => ({
    id,
    spent: p.spentThisRound || 0,
    prevOrder: gameState.turnOrder.indexOf(id)
  }));

  players.sort((a, b) => {
    if (a.spent !== b.spent) return a.spent - b.spent; // 花費少的先行動
    return a.prevOrder - b.prevOrder;
  });

  return players.map(p => p.id);
}

module.exports = {
  scoreLinkVP,
  scorePlayerLinks,
  scorePlayerIndustries,
  scoreCanalEra,
  scoreRailEra,
  calculateTurnOrder
};
