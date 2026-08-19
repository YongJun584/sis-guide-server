const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const sessionStore = require("../sessionStore");
const { getTokenFromHeader, requireAuth } = require("../middleware/auth");
const neis = require("../services/neisClient");
const mailer = require("../services/mailer");
const verificationCodes = require("../services/verificationCodes");
const cloudStore = require("../services/cloudStore");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

// 앱(avatar_icons.dart)에 정의된 것과 반드시 같은 id 목록이어야 합니다.
const VALID_AVATAR_ICON_IDS = [
  "baby_heart",
  "baby_star",
  "baby_calm",
  "baby_sleepy",
  "short_smile",
  "bob_chat",
  "side_heart",
  "pony_flower",
  "buns_sweet",
  "pigtail_sparkle",
  "scarf_music",
  "side_moon",
];

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    // 회원가입 때 인증한 이메일입니다. 아이디/비밀번호 찾기에 사용됩니다.
    // 이메일 인증 기능이 생기기 전에 만들어진 계정(seed 계정 등)은 null일 수 있습니다.
    email: user.email ?? null,
    // 급식 알레르기 경고 기능에서 씁니다. 설정한 적 없으면 빈 배열입니다.
    allergy_codes: user.allergy_codes ?? [],
    // 알레르기 설정 화면에서 저장을 한 번이라도 했는지 여부입니다. 이게 false면
    // "알레르기 없음"을 고른 게 아니라 그냥 아직 안 정한 상태라는 뜻입니다.
    allergy_confirmed: user.allergy_confirmed ?? false,
    // 매일 아침 7시 30분쯤 울리는 급식 알레르기 알림을 받을지 여부입니다.
    meal_alert_enabled: user.meal_alert_enabled ?? true,
    // 프로필 아바타. type이 'icon'이면 value는 위 id 목록 중 하나, 'photo'면
    // value는 /uploads/... 경로입니다. 둘 다 설정한 적 없으면 null입니다.
    avatar_type: user.avatar_type ?? null,
    avatar_value: user.avatar_value ?? null,
    // 목표 자격증. 큐넷(Q-net) 종목코드(jmCd)를 알고 있으면 시험일정을 자동으로
    // 조회할 수 있고, 모르면 이름만 등록해둘 수 있습니다. 등록한 적 없으면 전부 null.
    target_cert_name: user.target_cert_name ?? null,
    target_cert_jm_cd: user.target_cert_jm_cd ?? null,
    target_cert_qualgb_cd: user.target_cert_qualgb_cd ?? null,
    // 즐겨찾기한 버스정류장 목록. 등록한 적 없으면 빈 배열입니다.
    favorite_stops: user.favorite_stops ?? [],
  };
}

function issueSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessionStore.createSession(token, publicUser(user));
  return token;
}

// POST /api/auth/register/request-code - 회원가입용 이메일 인증코드 발송
// 회원가입 화면에서 이메일을 입력하고 "인증코드 받기"를 누르면 호출됩니다.
// 이미 다른 계정이 쓰고 있는 이메일이면 미리 막습니다(가입 단계에서 바로 알려주는 게
// 사용자 경험상 더 친절하다고 판단 - 아이디 찾기와 달리 여기서는 계정 존재 여부를
// 숨길 실익이 적습니다).
router.post("/register/request-code", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해주세요." });
  }
  if (!mailer.isEnabled) {
    return res.status(500).json({ error: "이메일 발송 기능이 아직 설정되지 않았습니다. 관리자에게 문의해주세요." });
  }

  const users = db.getUsers();
  if (users.some((u) => normalizeEmail(u.email) === email)) {
    return res.status(409).json({ error: "이미 가입에 사용된 이메일입니다." });
  }

  let code;
  try {
    code = verificationCodes.createCode(email, "register");
  } catch (err) {
    return res.status(429).json({ error: err.message });
  }

  try {
    await mailer.sendMail({
      to: email,
      subject: "[SIS LINK] 회원가입 인증코드",
      text: `SIS LINK 회원가입 인증코드는 ${code} 입니다.\n10분 안에 입력해주세요.`,
    });
  } catch (err) {
    return res.status(502).json({ error: `메일 발송에 실패했습니다. (${err.message})` });
  }

  res.json({ success: true });
});

// POST /api/auth/register - 회원가입
// 회원가입으로는 일반 사용자(role: "user") 또는 교사(role: "teacher") 계정만
// 만들 수 있습니다. isTeacher를 true로 보내면 교사 계정으로 가입됩니다.
// 관리자 계정은 보안상 회원가입으로 만들 수 없고, 서버 시딩(seed.js)으로만 생성됩니다.
// email/code: 먼저 /register/request-code로 받은 인증코드를 함께 보내야 합니다.
router.post("/register", (req, res) => {
  const { username, password, name, isTeacher, code } = req.body || {};
  const email = normalizeEmail(req.body?.email);

  if (!username || !password || !name) {
    return res.status(400).json({ error: "아이디, 비밀번호, 이름을 모두 입력해주세요." });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: "아이디는 3자 이상이어야 합니다." });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해주세요." });
  }
  if (!code) {
    return res.status(400).json({ error: "이메일로 받은 인증코드를 입력해주세요." });
  }

  const users = db.getUsers();
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
  }
  if (users.some((u) => normalizeEmail(u.email) === email)) {
    return res.status(409).json({ error: "이미 가입에 사용된 이메일입니다." });
  }
  if (!verificationCodes.verifyCode(email, "register", code)) {
    return res.status(400).json({ error: "인증코드가 올바르지 않거나 만료되었습니다." });
  }

  const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
  const newUser = {
    id: nextId,
    username: String(username).trim(),
    password: bcrypt.hashSync(password, 10),
    name: String(name).trim(),
    role: isTeacher === true ? "teacher" : "user",
    email,
  };
  users.push(newUser);
  db.saveUsers(users);

  const token = issueSession(newUser);
  res.status(201).json({ token, user: publicUser(newUser) });
});

// POST /api/auth/find-username - 이메일로 가입한 아이디를 찾아 메일로 보냅니다.
// 보안을 위해 그 이메일로 가입한 계정이 있든 없든 항상 같은 성공 응답을
// 돌려줍니다(계정 존재 여부가 노출되지 않도록).
router.post("/find-username", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해주세요." });
  }
  if (!mailer.isEnabled) {
    return res.status(500).json({ error: "이메일 발송 기능이 아직 설정되지 않았습니다. 관리자에게 문의해주세요." });
  }

  const user = db.getUsers().find((u) => normalizeEmail(u.email) === email);
  if (user) {
    try {
      await mailer.sendMail({
        to: email,
        subject: "[SIS LINK] 아이디 안내",
        text: `SIS LINK에 가입하신 아이디는 "${user.username}" 입니다.`,
      });
    } catch (err) {
      return res.status(502).json({ error: `메일 발송에 실패했습니다. (${err.message})` });
    }
  }

  res.json({ success: true, message: "해당 이메일로 가입한 계정이 있다면 아이디를 보내드렸습니다." });
});

// POST /api/auth/forgot-password/request-code - 비밀번호 재설정용 인증코드 발송
// find-username과 마찬가지로, 계정 존재 여부를 숨기기 위해 이메일이 등록되어
// 있지 않아도 항상 같은 성공 응답을 돌려줍니다.
router.post("/forgot-password/request-code", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해주세요." });
  }
  if (!mailer.isEnabled) {
    return res.status(500).json({ error: "이메일 발송 기능이 아직 설정되지 않았습니다. 관리자에게 문의해주세요." });
  }

  const user = db.getUsers().find((u) => normalizeEmail(u.email) === email);
  if (user) {
    let code;
    try {
      code = verificationCodes.createCode(email, "reset_password");
    } catch (err) {
      return res.status(429).json({ error: err.message });
    }
    try {
      await mailer.sendMail({
        to: email,
        subject: "[SIS LINK] 비밀번호 재설정 인증코드",
        text: `SIS LINK 비밀번호 재설정 인증코드는 ${code} 입니다.\n10분 안에 입력해주세요.`,
      });
    } catch (err) {
      return res.status(502).json({ error: `메일 발송에 실패했습니다. (${err.message})` });
    }
  }

  res.json({ success: true, message: "해당 이메일로 가입한 계정이 있다면 인증코드를 보내드렸습니다." });
});

// POST /api/auth/forgot-password/reset - 인증코드를 확인하고 비밀번호를 재설정합니다.
router.post("/forgot-password/reset", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { code, newPassword } = req.body || {};

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해주세요." });
  }
  if (!code) {
    return res.status(400).json({ error: "이메일로 받은 인증코드를 입력해주세요." });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: "새 비밀번호는 4자 이상이어야 합니다." });
  }

  if (!verificationCodes.verifyCode(email, "reset_password", code)) {
    return res.status(400).json({ error: "인증코드가 올바르지 않거나 만료되었습니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => normalizeEmail(u.email) === email);
  if (idx === -1) {
    return res.status(404).json({ error: "해당 이메일로 가입된 계정을 찾을 수 없습니다." });
  }
  users[idx].password = bcrypt.hashSync(String(newPassword), 10);
  db.saveUsers(users);

  res.json({ success: true });
});

// POST /api/auth/login - 아이디/비밀번호로 로그인
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }

  const user = db.getUsers().find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  const token = issueSession(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me - 토큰으로 로그인 상태 확인
router.get("/me", (req, res) => {
  const token = getTokenFromHeader(req);
  const session = token ? sessionStore.getSession(token) : null;

  if (!session) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  // 세션에는 로그인 시점 스냅샷만 들어있어서, allergy_codes 같은 값이 그 뒤에
  // 바뀌었을 수 있습니다. DB에서 최신 값을 다시 읽어 내려줍니다.
  const freshUser = db.getUsers().find((u) => u.id === session.id);
  res.json({ user: freshUser ? publicUser(freshUser) : session });
});

// PUT /api/auth/allergies - 급식 알레르기 경고 설정을 저장합니다.
// allergyCodes: 1~19 사이의 정수 배열 (neis.ALLERGY_NAMES 코드표 기준, 빈 배열이면 "알레르기 없음")
// mealAlertEnabled: 매일 아침 알림을 받을지 여부 (생략하면 기존 값 유지)
// 이 API를 한 번이라도 호출하면 allergy_confirmed가 true로 바뀝니다 - 빈 배열을
// 보낸 것도 "확인했지만 알레르기가 없다"는 의미이기 때문입니다.
router.put("/allergies", requireAuth, (req, res) => {
  const { allergyCodes, mealAlertEnabled } = req.body || {};
  if (!Array.isArray(allergyCodes) || !allergyCodes.every((c) => Number.isInteger(c) && neis.ALLERGY_NAMES[c])) {
    return res.status(400).json({ error: "allergyCodes는 1~19 사이의 정수 배열이어야 합니다." });
  }
  if (mealAlertEnabled !== undefined && typeof mealAlertEnabled !== "boolean") {
    return res.status(400).json({ error: "mealAlertEnabled는 true/false여야 합니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  users[idx].allergy_codes = Array.from(new Set(allergyCodes)).sort((a, b) => a - b);
  users[idx].allergy_confirmed = true;
  if (mealAlertEnabled !== undefined) users[idx].meal_alert_enabled = mealAlertEnabled;
  db.saveUsers(users);

  res.json({
    allergy_codes: users[idx].allergy_codes,
    allergy_confirmed: users[idx].allergy_confirmed,
    meal_alert_enabled: users[idx].meal_alert_enabled ?? true,
  });
});

// PUT /api/auth/avatar-icon - 미리 만들어둔 얼굴 아이콘 중 하나를 프로필로 설정합니다.
router.put("/avatar-icon", requireAuth, (req, res) => {
  const { iconId } = req.body || {};
  if (!iconId || !VALID_AVATAR_ICON_IDS.includes(iconId)) {
    return res.status(400).json({ error: `iconId는 다음 중 하나여야 합니다: ${VALID_AVATAR_ICON_IDS.join(", ")}` });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  users[idx].avatar_type = "icon";
  users[idx].avatar_value = iconId;
  db.saveUsers(users);

  res.json({ avatar_type: "icon", avatar_value: iconId });
});

// 업로드된 프로필 사진 저장 위치: <서버루트>/uploads/avatars/
const AVATAR_UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "avatars");
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
      cb(null, AVATAR_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${req.user.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  // 확실하지 않음/실제 원인: 앱(Flutter http 패키지)이 업로드할 때 파일의
  // Content-Type을 따로 지정하지 않으면 "application/octet-stream"으로 보내는
  // 경우가 있어서, mimetype만 보면 진짜 이미지 파일인데도 거부당했습니다.
  // 그래서 mimetype이 애매하면 파일 확장자로도 한 번 더 확인합니다.
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

// POST /api/auth/avatar-photo - 직접 찍거나 고른 사진을 프로필로 업로드합니다.
// multipart/form-data, 필드명 "photo" 하나로 보내면 됩니다.
router.post("/avatar-photo", requireAuth, (req, res) => {
  avatarUpload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "업로드에 실패했습니다." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "photo 파일이 필요합니다." });
    }

    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) {
      return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
    }
    const relativePath = `/uploads/avatars/${req.file.filename}`;
    users[idx].avatar_type = "photo";
    users[idx].avatar_value = relativePath;
    db.saveUsers(users);

    // uploads/ 폴더는 재배포/재시작마다 초기화되므로, 파일 자체도 외부 DB에
    // 백업해둡니다(설정 안 되어 있으면 cloudStore가 조용히 넘어갑니다).
    cloudStore.pushFile("avatars", req.file.filename, fs.readFileSync(req.file.path));

    res.json({ avatar_type: "photo", avatar_value: relativePath });
  });
});

// PUT /api/auth/profile - 표시 이름을 수정합니다.
router.put("/profile", requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "이름을 입력해주세요." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  users[idx].name = String(name).trim();
  db.saveUsers(users);

  res.json({ name: users[idx].name });
});

// PUT /api/auth/password - 비밀번호를 변경합니다. 현재 비밀번호 확인이 필요합니다.
router.put("/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호를 모두 입력해주세요." });
  }
  if (String(newPassword).length < 4) {
    return res.status(400).json({ error: "새 비밀번호는 4자 이상이어야 합니다." });
  }

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  if (!bcrypt.compareSync(currentPassword, users[idx].password)) {
    return res.status(401).json({ error: "현재 비밀번호가 올바르지 않습니다." });
  }
  users[idx].password = bcrypt.hashSync(newPassword, 10);
  db.saveUsers(users);

  res.json({ success: true });
});

// PUT /api/auth/certification - 목표 자격증을 설정합니다.
// jmCd(큐넷 종목코드)를 알면 함께 보내면 시험일정 자동조회(/api/certifications/schedule)에
// 쓰입니다. 모르면 name만 보내도 됩니다. name을 빈 문자열로 보내면 목표 자격증을 해제합니다.
router.put("/certification", requireAuth, (req, res) => {
  const { name, jmCd, qualgbCd } = req.body || {};

  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }

  if (!name || !String(name).trim()) {
    users[idx].target_cert_name = null;
    users[idx].target_cert_jm_cd = null;
    users[idx].target_cert_qualgb_cd = null;
  } else {
    users[idx].target_cert_name = String(name).trim();
    users[idx].target_cert_jm_cd = jmCd ? String(jmCd).trim() : null;
    users[idx].target_cert_qualgb_cd = qualgbCd ? String(qualgbCd).trim() : null;
  }
  db.saveUsers(users);

  res.json({
    target_cert_name: users[idx].target_cert_name,
    target_cert_jm_cd: users[idx].target_cert_jm_cd,
    target_cert_qualgb_cd: users[idx].target_cert_qualgb_cd,
  });
});

// DELETE /api/auth/avatar - 아이콘/사진 설정을 지우고 기본(이니셜) 표시로 되돌립니다.
router.delete("/avatar", requireAuth, (req, res) => {
  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  }
  users[idx].avatar_type = null;
  users[idx].avatar_value = null;
  db.saveUsers(users);

  res.json({ avatar_type: null, avatar_value: null });
});

// POST /api/auth/logout - 로그아웃 (토큰 폐기)
router.post("/logout", (req, res) => {
  const token = getTokenFromHeader(req);
  if (token) sessionStore.destroySession(token);
  res.json({ success: true });
});

module.exports = router;
