const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const scheduler = require("../services/scheduler");

const router = express.Router();

router.use(requireAuth);

// POST /api/schedule/generate
// body: { dayStart: "16:00", dayEnd: "22:00", fixedBlocks: [{ label, start, end }] }
// 로그인한 사용자의 미완료 할 일(done=false)들을 자동으로 하루 시간표에 채워
// 넣습니다. fixedBlocks(통학, 학원 등 이미 정해진 일정)는 클라이언트가 넘겨줍니다
// - 아직 이 서버에 "학교 수업 시간표" 데이터가 따로 없어서, 방과후 자유시간을
// 어떻게 쓸지 짜주는 것이 지금 범위입니다.
router.post("/generate", (req, res) => {
  const { dayStart = "16:00", dayEnd = "22:00", fixedBlocks = [] } = req.body || {};

  const dayStartMinutes = scheduler.toMinutes(dayStart);
  const dayEndMinutes = scheduler.toMinutes(dayEnd);
  if (dayStartMinutes == null || dayEndMinutes == null) {
    return res.status(400).json({ error: "dayStart/dayEnd는 'HH:MM' 형식이어야 합니다." });
  }
  if (!Array.isArray(fixedBlocks)) {
    return res.status(400).json({ error: "fixedBlocks는 배열이어야 합니다." });
  }

  const parsedFixedBlocks = [];
  for (const b of fixedBlocks) {
    const start = scheduler.toMinutes(b?.start);
    const end = scheduler.toMinutes(b?.end);
    if (start == null || end == null || end <= start) {
      return res.status(400).json({ error: `fixedBlocks 항목이 올바르지 않습니다: ${JSON.stringify(b)}` });
    }
    parsedFixedBlocks.push({ label: b.label || "고정 일정", start, end });
  }

  const tasks = db
    .getTodos()
    .filter((t) => t.user_id === req.user.id && !t.done)
    .map((t) => ({
      id: t.id,
      text: t.text,
      durationMinutes: t.duration_minutes ?? 30,
      priority: t.priority ?? "medium",
      dueDate: t.due_date ?? null,
    }));

  try {
    const result = scheduler.generateSchedule({
      dayStartMinutes,
      dayEndMinutes,
      fixedBlocks: parsedFixedBlocks,
      tasks,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
