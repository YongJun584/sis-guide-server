const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");
const cloudStore = require("../services/cloudStore");

const router = express.Router();

// 업로드된 작품 사진 저장 위치: <서버루트>/uploads/works/
// (auth.js의 avatar-photo 업로드와 같은 방식입니다)
const WORK_UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "works");
const workImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(WORK_UPLOAD_DIR, { recursive: true });
      cb(null, WORK_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  // 확실하지 않음/실제 원인: 앱(Flutter http 패키지)이 업로드할 때 파일의
  // Content-Type을 따로 지정하지 않으면 "application/octet-stream"으로 보내는
  // 경우가 있어서, mimetype만 보면 진짜 이미지 파일인데도 거부당했습니다
  // (avatar-photo 업로드와 같은 문제). mimetype이 애매하면 파일 확장자로도
  // 한 번 더 확인하도록 했습니다.
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isImageExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp"].includes(ext);
    const isImageMime = Boolean(file.mimetype) && file.mimetype.startsWith("image/");
    if (!isImageExt && !isImageMime) {
      return cb(new Error("이미지 파일만 업로드할 수 있습니다."));
    }
    cb(null, true);
  },
});

// POST /api/works/upload-image - 갤러리에서 고른 사진을 업로드하고, 저장된 경로를 돌려줍니다.
// (관리자 전용). multipart/form-data, 필드명 "photo" 하나로 보내면 됩니다.
// 응답의 image_url을 그대로 작품 등록/수정(POST/PUT /api/works)의 image_url로 쓰면 됩니다.
router.post("/upload-image", requireAdmin, (req, res) => {
  workImageUpload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "업로드에 실패했습니다." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "photo 파일이 필요합니다." });
    }

    // uploads/ 폴더는 재배포/재시작마다 초기화되므로, 파일 자체도 외부 DB에
    // 백업해둡니다(설정 안 되어 있으면 cloudStore가 조용히 넘어갑니다).
    cloudStore.pushFile("works", req.file.filename, fs.readFileSync(req.file.path));

    res.json({ image_url: `/uploads/works/${req.file.filename}` });
  });
});

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
