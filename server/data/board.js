// Brass: Birmingham board data
// All city locations, industry slots, connections, and merchant tiles

const { INDUSTRY_TYPES: T } = require('./constants');

// Each location has named slots with allowed industry types
const locations = {
  // --- Northern Region ---
  leek: {
    name: 'Leek',
    slots: [
      { id: 'leek-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'leek-1', types: [T.COAL], built: null }
    ]
  },
  'stoke-on-trent': {
    name: 'Stoke-on-Trent',
    slots: [
      { id: 'stoke-0', types: [T.POTTERY, T.MANUFACTURER], built: null },
      { id: 'stoke-1', types: [T.IRON], built: null },
      { id: 'stoke-2', types: [T.MANUFACTURER, T.COTTON], built: null }
    ]
  },
  stone: {
    name: 'Stone',
    slots: [
      { id: 'stone-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'stone-1', types: [T.BREWERY], built: null }
    ]
  },
  uttoxeter: {
    name: 'Uttoxeter',
    slots: [
      { id: 'uttoxeter-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'uttoxeter-1', types: [T.BREWERY], built: null }
    ]
  },

  // --- Central Region ---
  stafford: {
    name: 'Stafford',
    slots: [
      { id: 'stafford-0', types: [T.POTTERY, T.MANUFACTURER], built: null },
      { id: 'stafford-1', types: [T.MANUFACTURER], built: null }
    ]
  },
  cannock: {
    name: 'Cannock',
    slots: [
      { id: 'cannock-0', types: [T.COAL], built: null },
      { id: 'cannock-1', types: [T.MANUFACTURER], built: null }
    ]
  },
  burton: {
    name: 'Burton-on-Trent',
    slots: [
      { id: 'burton-0', types: [T.BREWERY], built: null },
      { id: 'burton-1', types: [T.COAL, T.MANUFACTURER], built: null }
    ]
  },
  tamworth: {
    name: 'Tamworth',
    slots: [
      { id: 'tamworth-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'tamworth-1', types: [T.COAL], built: null }
    ]
  },
  walsall: {
    name: 'Walsall',
    slots: [
      { id: 'walsall-0', types: [T.MANUFACTURER, T.IRON], built: null },
      { id: 'walsall-1', types: [T.BREWERY], built: null }
    ]
  },
  wolverhampton: {
    name: 'Wolverhampton',
    slots: [
      { id: 'wolverhampton-0', types: [T.MANUFACTURER], built: null },
      { id: 'wolverhampton-1', types: [T.COAL, T.MANUFACTURER], built: null }
    ]
  },
  coalbrookdale: {
    name: 'Coalbrookdale',
    slots: [
      { id: 'coalbrookdale-0', types: [T.IRON], built: null },
      { id: 'coalbrookdale-1', types: [T.COAL, T.IRON], built: null },
      { id: 'coalbrookdale-2', types: [T.BREWERY], built: null }
    ]
  },

  // --- Birmingham Area ---
  birmingham: {
    name: 'Birmingham',
    slots: [
      { id: 'birmingham-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'birmingham-1', types: [T.MANUFACTURER], built: null },
      { id: 'birmingham-2', types: [T.IRON, T.MANUFACTURER], built: null },
      { id: 'birmingham-3', types: [T.MANUFACTURER], built: null }
    ]
  },
  dudley: {
    name: 'Dudley',
    slots: [
      { id: 'dudley-0', types: [T.COAL], built: null },
      { id: 'dudley-1', types: [T.IRON], built: null }
    ]
  },

  // --- Eastern Region ---
  derby: {
    name: 'Derby',
    slots: [
      { id: 'derby-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'derby-1', types: [T.BREWERY], built: null },
      { id: 'derby-2', types: [T.MANUFACTURER], built: null }
    ]
  },
  belper: {
    name: 'Belper',
    slots: [
      { id: 'belper-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'belper-1', types: [T.COAL], built: null }
    ]
  },
  nuneaton: {
    name: 'Nuneaton',
    slots: [
      { id: 'nuneaton-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'nuneaton-1', types: [T.BREWERY], built: null }
    ]
  },
  coventry: {
    name: 'Coventry',
    slots: [
      { id: 'coventry-0', types: [T.POTTERY, T.MANUFACTURER], built: null },
      { id: 'coventry-1', types: [T.IRON, T.MANUFACTURER], built: null },
      { id: 'coventry-2', types: [T.MANUFACTURER], built: null }
    ]
  },

  // --- Southern Region ---
  kidderminster: {
    name: 'Kidderminster',
    slots: [
      { id: 'kidderminster-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'kidderminster-1', types: [T.COAL], built: null }
    ]
  },
  worcester: {
    name: 'Worcester',
    slots: [
      { id: 'worcester-0', types: [T.COTTON, T.MANUFACTURER], built: null },
      { id: 'worcester-1', types: [T.COTTON, T.MANUFACTURER], built: null }
    ]
  },
  redditch: {
    name: 'Redditch',
    slots: [
      { id: 'redditch-0', types: [T.MANUFACTURER, T.COAL], built: null },
      { id: 'redditch-1', types: [T.IRON], built: null }
    ]
  },
  // === 商人位置（不能建產業，只用於路線連接和販賣）===
  'merchant-shrewsbury': { name: 'Shrewsbury Market', isMerchant: true, slots: [] },
  'merchant-gloucester': { name: 'Gloucester', isMerchant: true, slots: [] },
  'merchant-oxford': { name: 'Oxford', isMerchant: true, slots: [] },
  'merchant-warrington': { name: 'Warrington', isMerchant: true, slots: [] },
  'merchant-nottingham': { name: 'Nottingham', isMerchant: true, slots: [] },

  // === 農莊啤酒廠（Farm Brewery）===
  // 只能用啤酒產業牌或萬能產業牌建造，只有啤酒廠槽位
  'farm-brewery-cannock': {
    name: '農莊啤酒廠',
    isFarmBrewery: true,
    slots: [
      { id: 'farm-cannock-0', types: [T.BREWERY], built: null }
    ]
  },
  'farm-brewery-kidwor': {
    name: '農莊啤酒廠',
    isFarmBrewery: true,
    slots: [
      { id: 'farm-kidwor-0', types: [T.BREWERY], built: null }
    ]
  }
};

// Connections between cities
// type: 'canal' = canal era only, 'rail' = rail era only, 'both' = available in both eras
const connections = [
  // Northern connections
  { from: 'leek', to: 'stoke-on-trent', type: 'both' },
  { from: 'leek', to: 'uttoxeter', type: 'both' },
  { from: 'stoke-on-trent', to: 'stone', type: 'both' },
  { from: 'stone', to: 'uttoxeter', type: 'rail' },
  { from: 'stone', to: 'stafford', type: 'both' },
  { from: 'uttoxeter', to: 'burton', type: 'both' },

  // Central connections
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

  // Birmingham area
  { from: 'birmingham', to: 'dudley', type: 'both' },
  { from: 'birmingham', to: 'redditch', type: 'canal' },
  { from: 'birmingham', to: 'worcester', type: 'both' },
  { from: 'birmingham', to: 'coventry', type: 'both' },
  { from: 'birmingham', to: 'nuneaton', type: 'rail' },

  // Eastern connections
  { from: 'derby', to: 'belper', type: 'both' },
  { from: 'nuneaton', to: 'coventry', type: 'both' },

  // Southern connections
  { from: 'dudley', to: 'coalbrookdale', type: 'both' },
  { from: 'dudley', to: 'kidderminster', type: 'both' },
  { from: 'kidderminster', to: 'worcester', type: 'both' },
  { from: 'kidderminster', to: 'coalbrookdale', type: 'canal' },
  { from: 'redditch', to: 'worcester', type: 'canal' },
  // 農莊啤酒廠連線
  // Cannock 左邊的農莊啤酒廠：需要一條路連接 Cannock
  { from: 'cannock', to: 'farm-brewery-cannock', type: 'both' },
  // Kidderminster/Worcester 之間的農莊啤酒廠：
  // 蓋一條路同時連接 Kidderminster 和 Worcester（不需要兩條）
  { from: 'kidderminster', to: 'farm-brewery-kidwor', type: 'both' },
  { from: 'worcester', to: 'farm-brewery-kidwor', type: 'both' },

  // 商人連線（需要蓋運河/鐵路才能連到商人）
  { from: 'coalbrookdale', to: 'merchant-shrewsbury', type: 'both' },
  { from: 'worcester', to: 'merchant-gloucester', type: 'both' },
  { from: 'birmingham', to: 'merchant-oxford', type: 'both' },
  { from: 'coventry', to: 'merchant-oxford', type: 'both' },
  { from: 'stoke-on-trent', to: 'merchant-warrington', type: 'both' },
  { from: 'stone', to: 'merchant-warrington', type: 'both' },
  { from: 'derby', to: 'merchant-nottingham', type: 'both' },
  { from: 'belper', to: 'merchant-nottingham', type: 'both' }
];

// 外部商人位置（固定在地圖上）
// bonus: 使用商人啤酒時的獎勵（固定，不隨機）
// bonusType: 'develop'=免費研發1個, 'income'=收入軌+2格, 'money'=獲得£5
const merchants = [
  {
    id: 'merchant-shrewsbury',
    name: 'Shrewsbury Market',
    connectedTo: ['coalbrookdale'],
    accepts: [],  // 由隨機板塊決定
    bonusType: 'money',
    bonusAmount: 5,
    bonusDesc: '獲得 £5'
  },
  {
    id: 'merchant-gloucester',
    name: 'Gloucester',
    connectedTo: ['worcester'],
    accepts: [],
    bonusType: 'develop',
    bonusAmount: 1,
    bonusDesc: '免費研發 1 個（不用鐵）'
  },
  {
    id: 'merchant-oxford',
    name: 'Oxford',
    connectedTo: ['birmingham', 'coventry'],
    accepts: [],
    bonusType: 'income',
    bonusAmount: 2,
    bonusDesc: '收入軌前進 2 格'
  },
  {
    id: 'merchant-warrington',
    name: 'Warrington',
    connectedTo: ['stoke-on-trent', 'stone'],
    accepts: [],
    bonusType: 'develop',
    bonusAmount: 1,
    bonusDesc: '免費研發 1 個（不用鐵）'
  },
  {
    id: 'merchant-nottingham',
    name: 'Nottingham',
    connectedTo: ['derby', 'belper'],
    accepts: [],
    bonusType: 'income',
    bonusAmount: 2,
    bonusDesc: '收入軌前進 2 格'
  }
];

// Merchant tiles (randomly placed on merchants at game start)
// Each has a type it accepts and potentially bonus beer availability
const merchantTiles = [
  { accepts: [T.COTTON], bonusVP: 0 },
  { accepts: [T.COTTON], bonusVP: 0 },
  { accepts: [T.MANUFACTURER], bonusVP: 0 },
  { accepts: [T.MANUFACTURER], bonusVP: 0 },
  { accepts: [T.COTTON, T.MANUFACTURER], bonusVP: 0 },
  { accepts: [T.POTTERY], bonusVP: 0 },
  { accepts: [T.POTTERY], bonusVP: 0 },
  { accepts: [T.MANUFACTURER, T.COTTON], bonusVP: 0 }
];

module.exports = { locations, connections, merchants, merchantTiles };
