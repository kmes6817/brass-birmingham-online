// Board layout data - positions mapped to actual board image
// Canvas size: 1000 x 1000 (square, matching board image)
// Board image: /img/board.png

const BOARD_IMAGE_SRC = '/img/board.jpg';

// City positions mapped to the actual board photograph
const BOARD_CITIES = {
  'leek':                    { x: 551, y: 89  },
  'stoke-on-trent':          { x: 420, y: 135 },
  'stone':                   { x: 320, y: 269 },
  'uttoxeter':               { x: 571, y: 249 },
  'stafford':                { x: 396, y: 353 },
  'cannock':                 { x: 481, y: 450 },
  'burton':                  { x: 684, y: 388 },
  'derby':                   { x: 756, y: 246 },
  'belper':                  { x: 757, y: 123 },
  'tamworth':                { x: 696, y: 503 },
  'wolverhampton':           { x: 380, y: 542 },
  'walsall':                 { x: 528, y: 562 },
  'coalbrookdale':           { x: 247, y: 569 },
  'nuneaton':                { x: 778, y: 596 },
  'birmingham':              { x: 627, y: 673 },
  'dudley':                  { x: 425, y: 661 },
  'coventry':                { x: 805, y: 706 },
  'kidderminster':           { x: 357, y: 760 },
  'worcester':               { x: 369, y: 886 },
  'redditch':                { x: 592, y: 821 },
  'farm-brewery-cannock':    { x: 309, y: 432 },
  'farm-brewery-kidwor':     { x: 254, y: 832 },
};

// External merchant locations (positioned at board edges)
const BOARD_MERCHANTS = {
  'merchant-shrewsbury': { x: 100, y: 540, name: '市場 Shrewsbury', accepts: ['cotton', 'manufacturer'] },
  'merchant-gloucester':  { x: 511, y: 918, name: '市場 Gloucester',  accepts: ['cotton', 'manufacturer'] },
  'merchant-oxford':      { x: 816, y: 830, name: '市場 Oxford',      accepts: ['cotton', 'manufacturer'] },
  'merchant-warrington':  { x: 280, y: 82,  name: '市場 Warrington',  accepts: ['manufacturer', 'cotton'] },
  'merchant-nottingham':  { x: 904, y: 144, name: '市場 Nottingham',  accepts: ['cotton', 'manufacturer'] }
};

// Merchant-to-city connections (drawn as dashed lines)
const MERCHANT_CONNECTIONS = [
  { from: 'merchant-shrewsbury', to: 'coalbrookdale' },
  { from: 'merchant-gloucester', to: 'worcester' },
  { from: 'merchant-oxford', to: 'birmingham' },
  { from: 'merchant-oxford', to: 'coventry' },
  { from: 'merchant-warrington', to: 'stoke-on-trent' },
  { from: 'merchant-warrington', to: 'stone' },
  { from: 'merchant-nottingham', to: 'derby' },
  { from: 'merchant-nottingham', to: 'belper' }
];

// Industry type display info
const INDUSTRY_DISPLAY = {
  cotton:       { symbol: '\u2660', label: '棉花', short: '棉', color: '#E8E8E8', textColor: '#333', iconBg: '#f5f5f5' },
  coal:         { symbol: '\u2666', label: '煤礦', short: '煤', color: '#3a3a3a', textColor: '#fff', iconBg: '#555' },
  iron:         { symbol: '\u2663', label: '鐵廠', short: '鐵', color: '#B8742C', textColor: '#fff', iconBg: '#cd853f' },
  manufacturer: { symbol: '\u2665', label: '工廠', short: '工', color: '#C4A06A', textColor: '#333', iconBg: '#deb887' },
  pottery:      { symbol: '\u25C6', label: '陶瓷', short: '陶', color: '#E05030', textColor: '#fff', iconBg: '#ff6347' },
  brewery:      { symbol: '\u2605', label: '啤酒', short: '酒', color: '#D4A020', textColor: '#333', iconBg: '#ffd700' }
};

// Player colors
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
const PLAYER_LIGHT_COLORS = ['#f5a0a0', '#a0c8f5', '#a0f5c8', '#c8a0f5'];

// Connection line data with route type
const BOARD_CONNECTIONS = [
  { from: 'leek', to: 'stoke-on-trent', type: 'both' },
  { from: 'leek', to: 'uttoxeter', type: 'both' },
  { from: 'stoke-on-trent', to: 'stone', type: 'both' },
  { from: 'stone', to: 'uttoxeter', type: 'rail' },
  { from: 'stone', to: 'stafford', type: 'both' },
  { from: 'uttoxeter', to: 'burton', type: 'both' },
  { from: 'stafford', to: 'cannock', type: 'both' },
  { from: 'cannock', to: 'walsall', type: 'both' },
  { from: 'cannock', to: 'wolverhampton', type: 'both' },
  { from: 'burton', to: 'tamworth', type: 'both' },
  { from: 'burton', to: 'derby', type: 'both' },
  { from: 'tamworth', to: 'walsall', type: 'both' },
  { from: 'tamworth', to: 'nuneaton', type: 'both' },
  { from: 'tamworth', to: 'birmingham', type: 'both' },
  { from: 'walsall', to: 'wolverhampton', type: 'both' },
  { from: 'walsall', to: 'birmingham', type: 'both' },
  { from: 'wolverhampton', to: 'coalbrookdale', type: 'both' },
  { from: 'wolverhampton', to: 'dudley', type: 'both' },
  { from: 'wolverhampton', to: 'birmingham', type: 'rail' },
  { from: 'birmingham', to: 'dudley', type: 'both' },
  { from: 'birmingham', to: 'redditch', type: 'canal' },
  { from: 'birmingham', to: 'worcester', type: 'both' },
  { from: 'birmingham', to: 'coventry', type: 'both' },
  { from: 'birmingham', to: 'nuneaton', type: 'rail' },
  { from: 'derby', to: 'belper', type: 'both' },
  { from: 'nuneaton', to: 'coventry', type: 'both' },
  { from: 'dudley', to: 'coalbrookdale', type: 'both' },
  { from: 'dudley', to: 'kidderminster', type: 'both' },
  { from: 'kidderminster', to: 'worcester', type: 'both' },
  { from: 'kidderminster', to: 'coalbrookdale', type: 'canal' },
  { from: 'redditch', to: 'worcester', type: 'canal' },
  // 農莊啤酒廠
  { from: 'cannock', to: 'farm-brewery-cannock', type: 'both' },
  { from: 'kidderminster', to: 'farm-brewery-kidwor', type: 'both' },
  { from: 'worcester', to: 'farm-brewery-kidwor', type: 'both' },
  // 商人連線（需蓋路才能賣）
  { from: 'coalbrookdale', to: 'merchant-shrewsbury', type: 'both' },
  { from: 'worcester', to: 'merchant-gloucester', type: 'both' },
  { from: 'birmingham', to: 'merchant-oxford', type: 'both' },
  { from: 'coventry', to: 'merchant-oxford', type: 'both' },
  { from: 'stoke-on-trent', to: 'merchant-warrington', type: 'both' },
  { from: 'stone', to: 'merchant-warrington', type: 'both' },
  { from: 'derby', to: 'merchant-nottingham', type: 'both' },
  { from: 'belper', to: 'merchant-nottingham', type: 'both' }
];

// Market price data
const COAL_MARKET_PRICES_DISPLAY = [1,1,2,2,3,3,4,4,5,5,6,7,8,8];
const COAL_MARKET_SIZE = 14;
const IRON_MARKET_PRICES_DISPLAY = [1,1,2,2,3,3,4,5,6,6];
const IRON_MARKET_SIZE = 10;

function getCoalBuyPrice(supply) {
  if (supply <= 0) return COAL_MARKET_PRICES_DISPLAY[COAL_MARKET_SIZE - 1];
  return COAL_MARKET_PRICES_DISPLAY[COAL_MARKET_SIZE - supply];
}
function getIronBuyPrice(supply) {
  if (supply <= 0) return IRON_MARKET_PRICES_DISPLAY[IRON_MARKET_SIZE - 1];
  return IRON_MARKET_PRICES_DISPLAY[IRON_MARKET_SIZE - supply];
}
