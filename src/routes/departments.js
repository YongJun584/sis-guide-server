const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/departments - 학과 목록
router.get("/", (req, res) => {
  const list = db
    .getDepartments()
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  res.json(list);
});

// GET /api/departments/:id - 학과 상세
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.getDepartments().find((d) => d.id === id);
  if (!row) {
    return res.status(404).json({ error: "학과를 찾을 수 없습니다." });
  }
  res.json(row);
});

module.exports = router;
