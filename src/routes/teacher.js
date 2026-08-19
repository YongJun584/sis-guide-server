const express = require("express");
const db = require("../db");
const { requireTeacher } = require("../middleware/auth");

const router = express.Router();

// 이 라우터의 모든 엔드포인트는 교사 로그인이 필요합니다.
router.use(requireTeacher);

// GET /api/teacher/inbox - 학생들이 나(교사)에게 보낸 할 일 목록
router.get("/inbox", (req, res) => {
  const users = db.getUsers();
  const list = db
    .getTodos()
    .filter((t) => t.teacher_id === req.user.id)
    .sort((a, b) => new Date(a.alert_at) - new Date(b.alert_at))
    .map((t) => {
      const student = users.find((u) => u.id === t.user_id);
      return {
        id: t.id,
        text: t.text,
        done: t.done,
        alert_at: t.alert_at,
        notified: t.notified ?? false,
        student_name: student ? student.name : "(알 수 없음)",
      };
    });
  res.json(list);
});

// POST /api/teacher/inbox/:id/ack - 이 할 일 알림을 확인(울렸음)으로 표시합니다.
// 앱이 알림 시각이 됐음을 감지해서 로컬 알림을 울린 뒤, 중복으로 울리지 않도록
// 이 API를 호출해 서버에도 "확인됨"으로 기록합니다.
router.post("/inbox/:id/ack", (req, res) => {
  const id = Number(req.params.id);
  const list = db.getTodos();
  const idx = list.findIndex((t) => t.id === id && t.teacher_id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "할 일을 찾을 수 없습니다." });
  }
  list[idx].notified = true;
  db.saveTodos(list);
  res.json({ success: true });
});

// GET /api/teacher/settings - 알림 수신 on/off 상태 조회
router.get("/settings", (req, res) => {
  const user = db.getUsers().find((u) => u.id === req.user.id);
  res.json({ notifyEnabled: user?.notifyEnabled ?? true });
});

// PUT /api/teacher/settings - 알림 수신 on/off 설정
router.put("/settings", (req, res) => {
  const { notifyEnabled } = req.body || {};
  if (typeof notifyEnabled !== "boolean") {
    return res.status(400).json({ error: "notifyEnabled는 true/false여야 합니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  users[idx].notifyEnabled = notifyEnabled;
  db.saveUsers(users);

  res.json({ notifyEnabled });
});

module.exports = router;
