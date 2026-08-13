const express = require("express");
const db = require("../db");

const router = express.Router();

function withDepartmentName(facility, departments) {
  const dept = departments.find((d) => d.id === facility.department_id);
  return { ...facility, department_name: dept ? dept.name : null };
}

// GET /api/facilities - 시설 목록 (학과명 포함)
router.get("/", (req, res) => {
  const departments = db.getDepartments();
  const list = db
    .getFacilities()
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((f) => withDepartmentName(f, departments));
  res.json(list);
});

// GET /api/facilities/:id - 시설 상세
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const departments = db.getDepartments();
  const row = db.getFacilities().find((f) => f.id === id);
  if (!row) {
    return res.status(404).json({ error: "시설을 찾을 수 없습니다." });
  }
  res.json(withDepartmentName(row, departments));
});

module.exports = router;
