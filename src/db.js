// 아주 단순한 JSON 파일 기반 저장소.
// (better-sqlite3 등 네이티브 모듈은 설치 환경에 따라 컴파일이 실패할 수 있어,
//  학생이 처음 세팅하기 쉽도록 순수 JS로만 구현했습니다. 데이터 규모가 커지면
//  SQLite/MySQL 등으로 교체하는 것을 권장합니다.)
//
// [중요] Render 무료 요금제는 디스크가 임시라서 재배포/재시작마다 이 파일들이
// 초기화됩니다. 그래서 DATABASE_URL 환경변수가 설정되어 있으면, 저장할 때마다
// 외부 Postgres(예: Neon)에도 같이 백업하고, 서버가 켜질 때 그 최신 데이터로
// 먼저 복원합니다. 자세한 내용은 src/services/cloudStore.js 참고.
// DATABASE_URL이 없으면(로컬 개발) 예전처럼 로컬 파일만 씁니다 - 동작 그대로.
"use strict";

const fs = require("fs");
const path = require("path");
const cloudStore = require("./services/cloudStore");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEPARTMENTS_FILE = path.join(DATA_DIR, "departments.json");
const FACILITIES_FILE = path.join(DATA_DIR, "facilities.json");
const WORKS_FILE = path.join(DATA_DIR, "works.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TODOS_FILE = path.join(DATA_DIR, "todos.json");
const CONGESTION_FILE = path.join(DATA_DIR, "congestion.json");

// Postgres에 백업/복원할 때 쓰는 key 이름과 로컬 파일의 대응표입니다.
const CLOUD_KEYS = {
  departments: DEPARTMENTS_FILE,
  facilities: FACILITIES_FILE,
  works: WORKS_FILE,
  users: USERS_FILE,
  todos: TODOS_FILE,
  congestion: CONGESTION_FILE,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(file) {
  ensureDataDir();
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// 서버 시작 시 한 번 호출: Postgres(DATABASE_URL)에 백업된 최신 데이터가
// 있으면 로컬 data/*.json 파일에 덮어써서 복원합니다. server.js에서
// app.listen() 전에 await로 호출해야 합니다 - 그래야 복원이 끝나기 전에
// 오래된(비어있는) 로컬 파일로 요청을 처리하는 일이 없습니다.
// DATABASE_URL이 없으면(로컬 개발) 아무 일도 하지 않습니다.
async function hydrate() {
  if (!cloudStore.isEnabled) return;
  console.log("[db] DATABASE_URL 감지됨 - 외부 DB에서 최신 데이터를 복원합니다...");
  for (const [key, file] of Object.entries(CLOUD_KEYS)) {
    const value = await cloudStore.pull(key);
    if (value !== null) {
      writeJson(file, value);
    }
  }
  console.log("[db] 복원 완료.");
}

const db = {
  getDepartments() {
    return readJson(DEPARTMENTS_FILE);
  },
  saveDepartments(list) {
    writeJson(DEPARTMENTS_FILE, list);
    cloudStore.push("departments", list);
  },
  getFacilities() {
    return readJson(FACILITIES_FILE);
  },
  saveFacilities(list) {
    writeJson(FACILITIES_FILE, list);
    cloudStore.push("facilities", list);
  },
  getWorks() {
    return readJson(WORKS_FILE);
  },
  saveWorks(list) {
    writeJson(WORKS_FILE, list);
    cloudStore.push("works", list);
  },
  getUsers() {
    return readJson(USERS_FILE);
  },
  saveUsers(list) {
    writeJson(USERS_FILE, list);
    cloudStore.push("users", list);
  },
  getTodos() {
    return readJson(TODOS_FILE);
  },
  saveTodos(list) {
    writeJson(TODOS_FILE, list);
    cloudStore.push("todos", list);
  },
  getCongestionReports() {
    return readJson(CONGESTION_FILE);
  },
  saveCongestionReports(list) {
    writeJson(CONGESTION_FILE, list);
    cloudStore.push("congestion", list);
  },
  hydrate,
};

module.exports = db;
