const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/teachers - 교사 계정 목록 (학생이 할 일을 보낼 교사를 고를 때 사용)
// 로그인한 사용자면 누구나 조회할 수 있지만, 비밀번호 등 민감한 정보는 빼고 내려줍니다.
router.get("/", requireAuth, (req, res) => {
  const teachers = db
    .getUsers()
    .filter((u) => u.role === "teacher")
    .map((u) => ({ id: u.id, username: u.username, name: u.name }));
  res.json(teachers);
});

module.exports = router;
