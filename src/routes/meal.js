const express = require("express");
const neis = require("../services/neisClient");

const router = express.Router();

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// GET /api/meal/allergy-codes - 식약처/교육부 19개 알레르기 유발식품 코드표.
// 앱의 알레르기 설정 화면(체크박스 목록)에서 이 값을 그대로 씁니다.
router.get("/allergy-codes", (req, res) => {
  const codes = Object.entries(neis.ALLERGY_NAMES).map(([code, name]) => ({ code: Number(code), name }));
  res.json(codes);
});

// GET /api/meal?date=YYYY-MM-DD - 그날의 급식(조식/중식/석식) 정보.
// 급식 메뉴 자체는 공개 정보라 로그인 없이도 조회할 수 있습니다.
router.get("/", async (req, res) => {
  const dateParam = req.query.date;
  const ymd = dateParam ? String(dateParam).replaceAll("-", "") : todayYmd();
  if (!/^\d{8}$/.test(ymd)) {
    return res.status(400).json({ error: "date는 'YYYY-MM-DD' 형식이어야 합니다." });
  }

  try {
    const meals = await neis.getMeals(ymd);
    res.json(meals);
  } catch (err) {
    res.status(502).json({ error: `급식 정보를 가져오지 못했습니다: ${err.message}` });
  }
});

module.exports = router;
