const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const tago = require("../services/tagoClient");

const router = express.Router();

// 학교 대표 좌표 (기본값, GPS를 못 가져왔을 때만 씀).
// 카카오맵에서 "서귀포산업과학고등학교"를 검색해 실제 검색 API 응답에서 받아온
// 좌표로 교정했습니다 (제주특별자치도 서귀포시 상효동 1237-1 / 516로 501).
// 예전 값(33.276, 126.56)은 학교에서 3km 이상 떨어진 엉뚱한 지점이라 이 좌표로
// 정류장을 조회하면 계속 빈 배열이 돌아왔습니다.
const SCHOOL_LATITUDE = 33.29717654;
const SCHOOL_LONGITUDE = 126.5944555;

const CONGESTION_LEVELS = ["low", "medium", "high"];
const CONGESTION_WINDOW_MS = 30 * 60 * 1000; // 최근 30분 신고만 "지금 혼잡도"로 취급합니다.
const CONGESTION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간 지난 신고는 저장할 때 같이 정리합니다.

// GET /api/bus/stops?lat=&lng= - 좌표 근처 버스정류장 목록 (기본값: 학교 좌표)
router.get("/stops", async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : SCHOOL_LATITUDE;
  const lng = req.query.lng ? Number(req.query.lng) : SCHOOL_LONGITUDE;

  try {
    const stops = await tago.findNearbyStops(lat, lng);
    res.json(stops);
  } catch (err) {
    // "fetch failed"는 Node가 진짜 원인(err.cause - DNS 실패, 연결 거부, 인증서
    // 오류 등)을 감싸버려서 메시지만 봐서는 원인을 알 수 없습니다. 원인을 바로
    // 확인할 수 있도록, 서버 로그와 응답 둘 다에 cause를 같이 남깁니다.
    // (확실하지 않음: 임시 디버깅용입니다 - 원인이 파악되면 다시 정리해야 합니다.)
    console.error("[bus/stops] TAGO 요청 실패:", err, "cause:", err.cause);
    res.status(502).json({
      error: `버스정류장 조회에 실패했습니다: ${err.message}`,
      cause: err.cause ? String(err.cause) : null,
    });
  }
});

// GET /api/bus/favorites - 내가 즐겨찾기한 정류장 목록
router.get("/favorites", requireAuth, (req, res) => {
  const user = db.getUsers().find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  res.json(user.favorite_stops ?? []);
});

// POST /api/bus/favorites - 정류장을 즐겨찾기에 추가합니다.
// body: { cityCode, nodeId, nodeName, nodeNo(선택), latitude, longitude }
// latitude/longitude를 같이 저장해두면, 즐겨찾기 목록에서 바로 도착정보
// 화면으로 이동할 때 정류장 좌표를 다시 조회할 필요가 없습니다.
router.post("/favorites", requireAuth, (req, res) => {
  const { cityCode, nodeId, nodeName, nodeNo, latitude, longitude } = req.body || {};
  if (!cityCode || !nodeId || !nodeName) {
    return res.status(400).json({ error: "cityCode, nodeId, nodeName은 필수입니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }

  const favorites = users[idx].favorite_stops ?? [];
  const already = favorites.some((f) => f.cityCode === String(cityCode) && f.nodeId === String(nodeId));
  if (!already) {
    favorites.push({
      cityCode: String(cityCode),
      nodeId: String(nodeId),
      nodeName: String(nodeName),
      nodeNo: nodeNo ? String(nodeNo) : null,
      latitude: latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== undefined ? Number(longitude) : null,
    });
  }
  users[idx].favorite_stops = favorites;
  db.saveUsers(users);

  res.status(201).json(favorites);
});

// DELETE /api/bus/favorites - 정류장을 즐겨찾기에서 뺍니다.
// body: { cityCode, nodeId }
router.delete("/favorites", requireAuth, (req, res) => {
  const { cityCode, nodeId } = req.body || {};
  if (!cityCode || !nodeId) {
    return res.status(400).json({ error: "cityCode와 nodeId는 필수입니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }

  const favorites = (users[idx].favorite_stops ?? []).filter(
    (f) => !(f.cityCode === String(cityCode) && f.nodeId === String(nodeId))
  );
  users[idx].favorite_stops = favorites;
  db.saveUsers(users);

  res.json(favorites);
});

// GET /api/bus/arrivals?cityCode=&nodeId= - 특정 정류장의 노선별 도착 예정 정보
router.get("/arrivals", async (req, res) => {
  const { cityCode, nodeId } = req.query;
  if (!cityCode || !nodeId) {
    return res.status(400).json({ error: "cityCode와 nodeId는 필수입니다." });
  }

  try {
    const arrivals = await tago.getStationArrivals(cityCode, nodeId);
    res.json(arrivals);
  } catch (err) {
    // /stops와 같은 이유로 cause를 같이 남깁니다 (임시 디버깅용).
    console.error("[bus/arrivals] TAGO 요청 실패:", err, "cause:", err.cause);
    res.status(502).json({
      error: `도착정보 조회에 실패했습니다: ${err.message}`,
      cause: err.cause ? String(err.cause) : null,
    });
  }
});

// POST /api/bus/congestion - 지금 타고 있거나 기다리는 버스의 혼잡도를 신고합니다.
// (크라우드소싱: TAGO API는 도착 시간만 주기 때문에, 실제 혼잡도는 학생들의
// 신고를 모아서 만들어내는 새로운 데이터입니다.)
router.post("/congestion", requireAuth, (req, res) => {
  const { cityCode, nodeId, routeId, level } = req.body || {};
  if (!cityCode || !nodeId || !routeId || !level) {
    return res.status(400).json({ error: "cityCode, nodeId, routeId, level은 필수입니다." });
  }
  if (!CONGESTION_LEVELS.includes(level)) {
    return res.status(400).json({ error: `level은 ${CONGESTION_LEVELS.join("/")} 중 하나여야 합니다.` });
  }

  const now = Date.now();
  // 24시간 지난 오래된 신고는 파일이 무한히 커지지 않도록 쓸 때마다 같이 정리합니다.
  const pruned = db.getCongestionReports().filter((r) => now - new Date(r.created_at).getTime() < CONGESTION_MAX_AGE_MS);

  const nextId = pruned.length > 0 ? Math.max(...pruned.map((r) => r.id)) + 1 : 1;
  const report = {
    id: nextId,
    user_id: req.user.id,
    cityCode: String(cityCode),
    nodeId: String(nodeId),
    routeId: String(routeId),
    level,
    created_at: new Date().toISOString(),
  };
  pruned.push(report);
  db.saveCongestionReports(pruned);

  res.status(201).json(report);
});

// GET /api/bus/congestion?cityCode=&nodeId=&routeId=(선택)
// 최근 30분 내 신고를 모아 노선별 혼잡도 현황을 돌려줍니다.
// level은 그 노선의 가장 최근 신고 값이고, counts는 최근 신고들의 여유/보통/혼잡 분포입니다.
router.get("/congestion", (req, res) => {
  const { cityCode, nodeId, routeId } = req.query;
  if (!cityCode || !nodeId) {
    return res.status(400).json({ error: "cityCode와 nodeId는 필수입니다." });
  }

  const now = Date.now();
  const recent = db
    .getCongestionReports()
    .filter((r) => r.cityCode === String(cityCode) && r.nodeId === String(nodeId))
    .filter((r) => now - new Date(r.created_at).getTime() < CONGESTION_WINDOW_MS)
    .filter((r) => (routeId ? r.routeId === String(routeId) : true));

  const byRoute = new Map();
  for (const r of recent) {
    if (!byRoute.has(r.routeId)) {
      byRoute.set(r.routeId, {
        routeId: r.routeId,
        level: r.level,
        lastReportedAt: r.created_at,
        reportCount: 0,
        counts: { low: 0, medium: 0, high: 0 },
      });
    }
    const entry = byRoute.get(r.routeId);
    entry.reportCount += 1;
    entry.counts[r.level] += 1;
    if (new Date(r.created_at) > new Date(entry.lastReportedAt)) {
      entry.lastReportedAt = r.created_at;
      entry.level = r.level;
    }
  }

  res.json(Array.from(byRoute.values()));
});

module.exports = router;
