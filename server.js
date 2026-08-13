require("dotenv").config();
const app = require("./src/app");
const seed = require("./src/seed");
const db = require("./src/db");

const PORT = process.env.PORT || 4000;

// 데이터가 하나도 없으면(최초 실행) 자동으로 시드 데이터를 채웁니다.
if (db.getDepartments().length === 0) {
  console.log("초기 데이터가 없어 시드 데이터를 생성합니다...");
  seed();
}

app.listen(PORT, () => {
  console.log(`SIS GUIDE 서버 실행 중: http://localhost:${PORT}`);
  console.log(`- 학과 목록:  http://localhost:${PORT}/api/departments`);
  console.log(`- 시설 목록:  http://localhost:${PORT}/api/facilities`);
});
