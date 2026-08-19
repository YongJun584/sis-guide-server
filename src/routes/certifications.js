const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const qnet = require("../services/qnetClient");

const router = express.Router();

// 서귀포산업과학고 학과별로 실제 취득을 권장하는 자격증들입니다. jmCd는
// 한국산업인력공단이 공식 제공하는 HRDKorea MCP(openapi.hrdkorea.or.kr/mcp)의
// 종목검색 도구로 하나하나 실제 조회해서 확인한 값입니다 - 그래서 전부
// verified: true입니다 (2026-08-19 확인). 아래 목록에 없는 자격증은 앱에서
// "종목코드 직접 입력"으로 큐넷에서 찾아 등록하거나, 채팅으로 자격증 이름을
// 알려주시면 같은 방식으로 확인해드릴 수 있습니다.
//
// 참고: "정보처리기능사", "웹디자인기능사", "컴퓨터그래픽스운용기능사",
// "드론자격증" 은 학과 안내에는 있었지만 조회 결과 정확한 명칭이 다르거나
// (예: 컴퓨터그래픽기능사, 웹디자인개발기능사) 국가기술자격 종목으로 존재하지
// 않아(드론) 목록에서 제외하거나 정확한 이름으로 바로잡았습니다.
const SUGGESTED_CERTS = [
  { name: "정보처리기사", jmCd: "1320", verified: true, category: "정보통신" },
  { name: "전기기능사", jmCd: "7780", verified: true, category: "전기.전자" },
  { name: "지게차운전기능사", jmCd: "7875", verified: true, category: "건설" },
  { name: "로더운전기능사", jmCd: "7866", verified: true, category: "건설" },
  { name: "롤러운전기능사", jmCd: "7871", verified: true, category: "건설" },
  { name: "굴착기운전기능사", jmCd: "7862", verified: true, category: "건설" },
  { name: "자동차정비기능사", jmCd: "6281", verified: true, category: "기계" },
  { name: "피복아크용접기능사", jmCd: "6223", verified: true, category: "재료" },
  { name: "조경기능사", jmCd: "7900", verified: true, category: "건설" },
  { name: "웹디자인개발기능사", jmCd: "7798", verified: true, category: "문화.예술.디자인.방송" },
  { name: "컴퓨터그래픽기능사", jmCd: "7796", verified: true, category: "문화.예술.디자인.방송" },
  { name: "전산응용건축제도기능사", jmCd: "7061", verified: true, category: "건설" },
  { name: "전산응용기계제도기능사", jmCd: "6151", verified: true, category: "기계" },
  { name: "에너지관리기능사", jmCd: "7761", verified: true, category: "환경.에너지" },
  { name: "신재생에너지발전설비기능사(태양광)", jmCd: "7114", verified: true, category: "환경.에너지" },
  { name: "승강기기능사", jmCd: "7940", verified: true, category: "기계" },
];

// GET /api/certifications/suggested - 목표 자격증을 고를 때 참고용 예시 목록
router.get("/suggested", (req, res) => {
  res.json(SUGGESTED_CERTS);
});

// GET /api/certifications/schedule?jmCd=&implYy=&qualgbCd= - 임의의 종목코드로 시험일정 조회
router.get("/schedule", async (req, res) => {
  const { jmCd, implYy, qualgbCd } = req.query || {};
  if (!jmCd) {
    return res.status(400).json({ error: "jmCd(큐넷 종목코드) 쿼리 파라미터가 필요합니다." });
  }
  try {
    const schedule = await qnet.getExamSchedule({ jmCd, implYy, qualgbCd });
    res.json({ jmCd, implYy: implYy || String(new Date().getFullYear()), schedule });
  } catch (err) {
    if (err instanceof qnet.QnetConfigError) {
      return res.status(503).json({ error: err.message, code: "NO_SERVICE_KEY" });
    }
    console.error(err);
    res.status(502).json({ error: err.message || "큐넷 시험일정을 가져오지 못했습니다." });
  }
});

// GET /api/certifications/my-schedule - 로그인한 사용자가 등록해둔 목표 자격증의 시험일정
router.get("/my-schedule", requireAuth, async (req, res) => {
  const user = db.getUsers().find((u) => u.id === req.user.id);
  if (!user || !user.target_cert_name) {
    return res.json({ target_cert_name: null, jm_cd_registered: false, schedule: [] });
  }
  if (!user.target_cert_jm_cd) {
    // 이름만 등록했고 jmCd(종목코드)는 모르는 경우 - 자동조회는 못 하고,
    // 큐넷에서 직접 확인하라고 안내합니다.
    return res.json({
      target_cert_name: user.target_cert_name,
      jm_cd_registered: false,
      schedule: [],
      hint: "종목코드(jmCd)가 등록되어 있지 않아 시험일정을 자동으로 불러올 수 없습니다. 큐넷(q-net.or.kr)에서 직접 확인해주세요.",
    });
  }

  try {
    const schedule = await qnet.getExamSchedule({
      jmCd: user.target_cert_jm_cd,
      qualgbCd: user.target_cert_qualgb_cd || undefined,
    });
    res.json({ target_cert_name: user.target_cert_name, jm_cd_registered: true, schedule });
  } catch (err) {
    if (err instanceof qnet.QnetConfigError) {
      return res.status(503).json({ error: err.message, code: "NO_SERVICE_KEY" });
    }
    console.error(err);
    res.status(502).json({ error: err.message || "큐넷 시험일정을 가져오지 못했습니다." });
  }
});

module.exports = router;
