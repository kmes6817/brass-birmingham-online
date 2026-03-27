// 路線視覺數據（端點偏移 + 彎曲控制點）
// 用 /calibrate-routes.html 校正
// 每條路線 key = "from|to"
// startOff: 起點相對城市中心的偏移
// endOff: 終點相對城市中心的偏移
// curve: 貝茲曲線控制點偏移（0=直線，正=右彎，負=左彎）
const ROUTE_VISUAL = {};
