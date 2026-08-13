const express = require("express");
const cors = require("cors");

const departmentsRouter = require("./routes/departments");
const facilitiesRouter = require("./routes/facilities");

const app = express();

const corsAllowAll = (process.env.CORS_ALLOW_ALL ?? "true") === "true";
app.use(cors(corsAllowAll ? {} : { origin: process.env.ALLOWED_ORIGIN }));

app.use(express.json());

// 헬스체크 (앱에서 서버 연결 확인용)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "sis-guide-server" });
});

app.use("/api/departments", departmentsRouter);
app.use("/api/facilities", facilitiesRouter);

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
