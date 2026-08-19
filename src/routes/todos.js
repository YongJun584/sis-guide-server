const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// 이 라우터의 모든 엔드포인트는 로그인이 필요합니다.
router.use(requireAuth);

const VALID_PRIORITIES = ["low", "medium", "high"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:MM"

function publicTodo(todo) {
  return {
    id: todo.id,
    text: todo.text,
    done: todo.done,
    created_at: todo.created_at,
    // 교사에게 "보내기"를 하지 않은 할 일은 아래 값이 전부 null입니다.
    teacher_id: todo.teacher_id ?? null,
    teacher_username: todo.teacher_username ?? null,
    alert_at: todo.alert_at ?? null,
    notified: todo.notified ?? false,
    // 시간표 자동 생성(/api/schedule/generate)에 쓰이는 값들입니다. 전부
    // 선택값이라, 예전에 만든 할 일에는 서버가 기본값을 채워서 내려줍니다.
    duration_minutes: todo.duration_minutes ?? 30,
    priority: todo.priority ?? "medium",
    due_date: todo.due_date ?? null,
    // 세밀한 시간 조정: 구체적으로 몇 시부터 시작할지 정해뒀다면 "HH:MM" 형태로
    // 들어있습니다. 안 정했으면 null이고, 이때는 시간표 자동 생성이 빈 시간에
    // 알아서 배치합니다.
    start_time: todo.start_time ?? null,
    // 팀 작업용 담당자 라벨입니다. 실제 계정과 연결된 건 아니고, 자유롭게 적은
    // 이름/이니셜입니다 (예: "나", "김철수", "1조"). 안 정했으면 null입니다.
    assignee: todo.assignee ?? null,
    // 세부 메모(장소, 준비물 등). 선택값입니다.
    note: todo.note ?? null,
  };
}

function validateTodoFields(body) {
  const { priority, start_time, duration_minutes } = body || {};
  if (priority !== undefined && priority !== null && !VALID_PRIORITIES.includes(priority)) {
    return `priority는 ${VALID_PRIORITIES.join("/")} 중 하나여야 합니다.`;
  }
  if (start_time !== undefined && start_time !== null && !TIME_RE.test(String(start_time))) {
    return "start_time은 \"HH:MM\" 형식이어야 합니다. (예: 09:30)";
  }
  if (duration_minutes !== undefined && duration_minutes !== null) {
    const n = Number(duration_minutes);
    if (!Number.isFinite(n) || n <= 0 || n > 24 * 60) {
      return "duration_minutes는 1~1440 사이의 숫자여야 합니다.";
    }
  }
  return null;
}

// GET /api/todos - 내 할 일 목록 (로그인한 사용자 것만)
router.get("/", (req, res) => {
  const list = db
    .getTodos()
    .filter((t) => t.user_id === req.user.id)
    .sort((a, b) => a.id - b.id)
    .map(publicTodo);
  res.json(list);
});

// POST /api/todos - 할 일 추가
// duration_minutes(소요시간, 분), priority(low/medium/high), due_date(YYYY-MM-DD),
// start_time(HH:MM), assignee(담당자 라벨), note(메모)는 전부 선택값입니다 -
// 안 보내면 기본값(30분/medium/없음)이 들어갑니다.
router.post("/", (req, res) => {
  const { text, duration_minutes, priority, due_date, start_time, assignee, note } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: "할 일 내용을 입력해주세요." });
  }
  const fieldError = validateTodoFields(req.body);
  if (fieldError) {
    return res.status(400).json({ error: fieldError });
  }

  const list = db.getTodos();
  const nextId = list.length > 0 ? Math.max(...list.map((t) => t.id)) + 1 : 1;
  const todo = {
    id: nextId,
    user_id: req.user.id,
    text: String(text).trim(),
    done: false,
    created_at: new Date().toISOString(),
    duration_minutes: duration_minutes != null ? Number(duration_minutes) : 30,
    priority: priority ?? "medium",
    due_date: due_date || null,
    start_time: start_time || null,
    assignee: assignee ? String(assignee).trim() : null,
    note: note ? String(note).trim() : null,
  };
  list.push(todo);
  db.saveTodos(list);

  res.status(201).json(publicTodo(todo));
});

// PUT /api/todos/:id - 할 일 수정(내용/완료/소요시간/우선순위/마감일/시작시간/담당자/메모). 본인 것만 가능합니다.
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const list = db.getTodos();
  const idx = list.findIndex((t) => t.id === id && t.user_id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "할 일을 찾을 수 없습니다." });
  }

  const { text, done, duration_minutes, priority, due_date, start_time, assignee, note } = req.body || {};
  const fieldError = validateTodoFields(req.body);
  if (fieldError) {
    return res.status(400).json({ error: fieldError });
  }
  if (text !== undefined) list[idx].text = String(text).trim();
  if (done !== undefined) list[idx].done = Boolean(done);
  if (duration_minutes !== undefined) list[idx].duration_minutes = Number(duration_minutes);
  if (priority !== undefined) list[idx].priority = priority;
  if (due_date !== undefined) list[idx].due_date = due_date || null;
  if (start_time !== undefined) list[idx].start_time = start_time || null;
  if (assignee !== undefined) list[idx].assignee = assignee ? String(assignee).trim() : null;
  if (note !== undefined) list[idx].note = note ? String(note).trim() : null;

  db.saveTodos(list);
  res.json(publicTodo(list[idx]));
});

// PUT /api/todos/:id/send - 이 할 일을 교사에게 보내서, 지정한 시각에 교사 쪽에
// 알림이 울리게 합니다. (학생이 수업 중 휴대폰을 쓸 수 없을 때, 담임 교사가 대신
// 알림을 받을 수 있도록 하는 기능입니다.) 본인 할 일만 보낼 수 있습니다.
router.put("/:id/send", (req, res) => {
  const id = Number(req.params.id);
  const list = db.getTodos();
  const idx = list.findIndex((t) => t.id === id && t.user_id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "할 일을 찾을 수 없습니다." });
  }

  const { teacherUsername, alertAt } = req.body || {};
  if (!teacherUsername || !alertAt) {
    return res.status(400).json({ error: "teacherUsername과 alertAt(알림 시각)은 필수입니다." });
  }

  const teacher = db.getUsers().find((u) => u.username === teacherUsername && u.role === "teacher");
  if (!teacher) {
    return res.status(400).json({ error: "존재하지 않는 교사 계정입니다." });
  }

  const alertDate = new Date(alertAt);
  if (Number.isNaN(alertDate.getTime())) {
    return res.status(400).json({ error: "alertAt은 올바른 날짜/시간 형식이어야 합니다. (ISO 8601)" });
  }

  list[idx].teacher_id = teacher.id;
  list[idx].teacher_username = teacher.username;
  list[idx].alert_at = alertDate.toISOString();
  list[idx].notified = false;

  db.saveTodos(list);
  res.json(publicTodo(list[idx]));
});

// DELETE /api/todos/:id - 할 일 삭제. 본인 것만 가능합니다.
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const list = db.getTodos();
  const idx = list.findIndex((t) => t.id === id && t.user_id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "할 일을 찾을 수 없습니다." });
  }

  list.splice(idx, 1);
  db.saveTodos(list);
  res.json({ success: true });
});

module.exports = router;
