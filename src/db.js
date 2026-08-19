// 아주 단순한 JSON 파일 기반 저장소.
// (better-sqlite3 등 네이티브 모듈은 설치 환경에 따라 컴파일이 실패할 수 있어,
//  학생이 처음 세팅하기 쉽도록 순수 JS로만 구현했습니다. 데이터 규모가 커지면
//  SQLite/MySQL 등으로 교체하는 것을 권장합니다.)
"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEPARTMENTS_FILE = path.join(DATA_DIR, "departments.json");
const FACILITIES_FILE = path.join(DATA_DIR, "facilities.json");
const WORKS_FILE = path.join(DATA_DIR, "works.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TODOS_FILE = path.join(DATA_DIR, "todos.json");
const CONGESTION_FILE = path.join(DATA_DIR, "congestion.json");

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

const db = {
  getDepartments() {
    return readJson(DEPARTMENTS_FILE);
  },
  saveDepartments(list) {
    writeJson(DEPARTMENTS_FILE, list);
  },
  getFacilities() {
    return readJson(FACILITIES_FILE);
  },
  saveFacilities(list) {
    writeJson(FACILITIES_FILE, list);
  },
  getWorks() {
    return readJson(WORKS_FILE);
  },
  saveWorks(list) {
    writeJson(WORKS_FILE, list);
  },
  getUsers() {
    return readJson(USERS_FILE);
  },
  saveUsers(list) {
    writeJson(USERS_FILE, list);
  },
  getTodos() {
    return readJson(TODOS_FILE);
  },
  saveTodos(list) {
    writeJson(TODOS_FILE, list);
  },
  getCongestionReports() {
    return readJson(CONGESTION_FILE);
  },
  saveCongestionReports(list) {
    writeJson(CONGESTION_FILE, list);
  },
};

module.exports = db;
