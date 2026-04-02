// 路線視覺數據（端點偏移 + 彎曲控制點）
// 用 /calibrate-routes.html 校正後貼入此處
// 每條路線 key = "from|to"
// startOff: 起點相對城市中心的偏移
// endOff: 終點相對城市中心的偏移
// curve: 貝茲曲線控制點偏移（0=直線，正=右彎，負=左彎）
//
// ⚠️ 目前為空物件：renderer.js 讀不到資料時會 fallback 為直線渲染，功能正常。
// 若要讓路線有彎曲效果，請執行 /calibrate-routes.html 並將輸出貼入此處。
const ROUTE_VISUAL = {};
