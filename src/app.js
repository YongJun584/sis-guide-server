const path = require("path");
const express = require("express");
const cors = require("cors");

const departmentsRouter = require("./routes/departments");
const facilitiesRouter = require("./routes/facilities");
const worksRouter = require("./routes/works");
const authRouter = require("./routes/auth");
const todosRouter = require("./routes/todos");
const busRouter = require("./routes/bus");
const teachersRouter = require("./routes/teachers");
const teacherRouter = require("./routes/teacher");
const scheduleRouter = require("./routes/schedule");
const mealRouter = require("./routes/meal");
const certificationsRouter = require("./routes/certifications");

const app = express();

const corsAllowAll = (process.env.CORS_ALLOW_ALL ?? "true") === "true";
app.use(cors(corsAllowAll ? {} : { origin: process.env.ALLOWED_ORIGIN }));

app.use(express.json());

// 들어오는 요청(GET/POST 등)을 콘솔에 로그로 남깁니다. (요청 시각 / 메서드 / 경로)
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  console.log(`[${time}] ${req.method} ${req.originalUrl}`);
  next();
});

// 헬스체크 (앱에서 서버 연결 확인용)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "sis-guide-server" });
});

// 손님용 웹사이트 (앱 설치 없이 브라우저로 학과소개/작품갤러리만 보는 정적 사이트).
// QR코드로 이 주소(/site)를 스캔하면 바로 뜹니다. 같은 서버의 /api/departments,
// /api/works를 그대로 재사용합니다 (같은 출처라 CORS 걱정 없음).
app.use("/site", express.static(path.join(__dirname, "..", "public", "site")));

// 업로드된 프로필 사진 (POST /api/auth/avatar-photo가 여기 저장합니다)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/departments", departmentsRouter);
app.use("/api/facilities", facilitiesRouter);
app.use("/api/works", worksRouter);
app.use("/api/auth", authRouter);
app.use("/api/todos", todosRouter);
app.use("/api/bus", busRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/meal", mealRouter);
app.use("/api/certifications", certificationsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// 에러 핸들러
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
});

module.exports = app;
