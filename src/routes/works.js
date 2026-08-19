const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function withDepartmentName(work, departments) {
  const dept = departments.find((d) => d.id === work.department_id);
  return { ...work, department_name: dept ? dept.name : null };
}

// GET /api/works               - 전체 작품 목록
// GET /api/works?department_id=3 - 특정 학과의 작품만
router.get("/", (req, res) => {
  const departments = db.getDepartments();
  let list = db.getWorks();

  if (req.query.department_id) {
    const id = Number(req.query.department_id);
    list = list.filter((w) => w.department_id === id);
  }

  list = list
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((w) => withDepartmentName(w, departments));

  res.json(list);
});

// GET /api/works/:id - 작품 상세
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const departments = db.getDepartments();
  const row = db.getWorks().find((w) => w.id === id);
  if (!row) {
    return res.status(404).json({ error: "작품을 찾을 수 없습니다." });
  }
  res.json(withDepartmentName(row, departments));
});

// POST /api/works - 작품 등록 (관리자 전용)
router.post("/", requireAdmin, (req, res) => {
  const { department_id, title, description, image_url, student_name, year } = req.body || {};

  if (!department_id || !title || !String(title).trim()) {
    return res.status(400).json({ error: "department_id와 title은 필수입니다." });
  }

  const departments = db.getDepartments();
  if (!departments.some((d) => d.id === Number(department_id))) {
    return res.status(400).json({ error: "존재하지 않는 학과입니다." });
  }

  const list = db.getWorks();
  const nextId = list.length > 0 ? Math.max(...list.map((w) => w.id)) + 1 : 1;
  const work = {
    id: nextId,
    department_id: Number(department_id),
    title: String(title).trim(),
    description: description || null,
    image_url: image_url || null,
    student_name: student_name || null,
    year: year != null && year !== "" ? Number(year) : null,
    sort_order: list.length + 1,
  };
  list.push(work);
  db.saveWorks(list);

  res.status(201).json(withDepartmentName(work, departments));
});

// PUT /api/works/:id - 작품 수정 (관리자 전용)
router.put("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = db.getWorks();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "작품을 찾을 수 없습니다." });
  }

  const { department_id, title, description, image_url, student_name, year } = req.body || {};
  if (department_id !== undefined) list[idx].department_id = Number(department_id);
  if (title !== undefined) list[idx].title = String(title).trim();
  if (description !== undefined) list[idx].description = description || null;
  if (image_url !== undefined) list[idx].image_url = image_url || null;
  if (student_name !== undefined) list[idx].student_name = student_name || null;
  if (year !== undefined) list[idx].year = year != null && year !== "" ? Number(year) : null;

  db.saveWorks(list);
  res.json(withDepartmentName(list[idx], db.getDepartments()));
});

// DELETE /api/works/:id - 작품 삭제 (관리자 전용)
router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = db.getWorks();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "작품을 찾을 수 없습니다." });
  }
  list.splice(idx, 1);
  db.saveWorks(list);
  res.json({ success: true });
});

module.exports = router;
