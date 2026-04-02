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

// Score all links for a player (with detailed breakdown)
function scorePlayerLinks(gameState, playerId) {
  let totalVP = 0;
  const details = [];
  for (const link of gameState.links) {
    if (link.owner === playerId) {
      const vp = scoreLinkVP(link, gameState.board);
      totalVP += vp;
      details.push({ from: link.from, to: link.to, vp, type: link.type });
    }
  }
  return { total: totalVP, details };
}

// Score all flipped industries for a player (with detailed breakdown)
function scorePlayerIndustries(gameState, playerId) {
  let totalVP = 0;
  const details = [];
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built && slot.built.owner === playerId && slot.built.flipped) {
        totalVP += slot.built.vp;
        details.push({ location: locId, type: slot.built.type, level: slot.built.level, vp: slot.built.vp });
      }
    }
  }
  return { total: totalVP, details };
}

// End of Canal Era scoring and cleanup
function scoreCanalEra(gameState) {
  const scores = {};

  for (const playerId of Object.keys(gameState.players)) {
    const linkResult = scorePlayerLinks(gameState, playerId);
    const industryResult = scorePlayerIndustries(gameState, playerId);
    scores[playerId] = {
      linkVP: linkResult.total,
      industryVP: industryResult.total,
      total: linkResult.total + industryResult.total,
      linkDetails: linkResult.details,
      industryDetails: industryResult.details
    };
    gameState.players[playerId].vp += linkResult.total + industryResult.total;
  }

  // 注意：收入階段由 BrassGame.endRound() 處理，此處不再重複發放

  // Remove all canal-era links
  gameState.links = gameState.links.filter(l => l.type !== 'canal');

  // Remove ALL industry tiles from board (canal era ends, board resets)
  // Players may have developed and built level-2+ tiles during canal era,
  // which must also be cleared — only level-1 tiles have era:'canal' but
  // any tile built during canal era is removed regardless of level.
  for (const [locId, loc] of Object.entries(gameState.board)) {
    for (const slot of loc.slots) {
      if (slot.built) {
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
    const linkResult = scorePlayerLinks(gameState, playerId);
    const industryResult = scorePlayerIndustries(gameState, playerId);
    scores[playerId] = {
      linkVP: linkResult.total,
      industryVP: industryResult.total,
      total: linkResult.total + industryResult.total,
      linkDetails: linkResult.details,
      industryDetails: industryResult.details
    };
    gameState.players[playerId].vp += linkResult.total + industryResult.total;
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
