// 무료 외부 Postgres(Neon 등)에 JSON 데이터를 백업/복원하는 아주 단순한 모듈입니다.
//
// 왜 필요한가: Render 무료 요금제는 디스크가 "임시"라서, 서버가 재시작되면
// (재배포는 물론, 한동안 안 쓰면 자동으로 잠들었다 깨어날 때도) data/*.json
// 파일이 초기화됩니다. 그래서 회원가입/할일/작품 등록 같은 실사용 데이터가
// 자꾸 사라졌습니다.
//
// 해결 방법: 기존 db.js의 JSON 파일 방식은 그대로 두고(빠르고 코드 변경이 적음),
// 저장할 때마다 그 내용을 통째로 Postgres의 한 테이블(key-value, JSONB)에도
// 같이 백업합니다(push). 서버가 켜질 때는 반대로 Postgres에 저장된 최신
// 내용을 data/*.json 파일로 먼저 복원(pull)한 뒤에 서버를 시작합니다.
//
// DATABASE_URL 환경변수가 없으면(로컬 개발 등) 이 모듈은 아무것도 안 하고
// 조용히 넘어갑니다 - 기존처럼 로컬 JSON 파일만 씁니다.
"use strict";

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // Neon 같은 무료 DB는 한동안 안 쓰면 잠들었다가 첫 연결에서 깨어나는 데
      // 몇 초 걸릴 수 있어, 타임아웃을 넉넉하게 잡습니다.
      connectionTimeoutMillis: 15000,
    })
  : null;

let readyPromise = null;

function ensureTable() {
  if (!pool) return Promise.resolve();
  if (!readyPromise) {
    readyPromise = pool.query(
      `CREATE TABLE IF NOT EXISTS app_data (
         key TEXT PRIMARY KEY,
         value JSONB NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
  }
  return readyPromise;
}

// 업로드된 파일(프로필 사진, 작품 사진)도 uploads/ 폴더가 재배포/재시작마다
// 초기화되는 문제가 있어서, JSON 데이터와 마찬가지로 Postgres에도 파일
// 원본(바이너리)을 함께 백업합니다. subdir(예: "avatars", "works")별로
// 여러 파일을 저장할 수 있게 (subdir, filename)을 기본키로 씁니다.
let filesReadyPromise = null;

function ensureFilesTable() {
  if (!pool) return Promise.resolve();
  if (!filesReadyPromise) {
    filesReadyPromise = pool.query(
      `CREATE TABLE IF NOT EXISTS app_files (
         subdir TEXT NOT NULL,
         filename TEXT NOT NULL,
         data BYTEA NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (subdir, filename)
       )`
    );
  }
  return filesReadyPromise;
}

// 업로드 직후 호출합니다. buffer는 파일 내용(Buffer)입니다.
async function pushFile(subdir, filename, buffer) {
  if (!pool) return;
  try {
    await ensureFilesTable();
    await pool.query(
      `INSERT INTO app_files (subdir, filename, data, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (subdir, filename) DO UPDATE SET data = $3, updated_at = now()`,
      [subdir, filename, buffer]
    );
  } catch (err) {
    console.error(`[cloudStore] 파일 백업 실패 (${subdir}/${filename}):`, err.message);
  }
}

// 서버 시작 시 한 번씩 호출합니다. 해당 subdir에 백업된 모든 파일을
// [{ filename, data }] 형태로 돌려줍니다(data는 Buffer).
async function pullAllFiles(subdir) {
  if (!pool) return [];
  try {
    await ensureFilesTable();
    const res = await pool.query(`SELECT filename, data FROM app_files WHERE subdir = $1`, [subdir]);
    return res.rows;
  } catch (err) {
    console.error(`[cloudStore] 파일 목록 복원 실패 (${subdir}):`, err.message);
    return [];
  }
}

// 로컬 파일에 저장한 직후 호출합니다. 실패해도(네트워크 오류 등) 로컬 저장은
// 이미 끝난 뒤라 사용자 요청 자체는 실패하지 않습니다 - 콘솔에만 에러를
// 남깁니다(그래서 이 함수는 항상 성공(resolve)하고, 절대 reject하지 않습니다).
async function push(key, value) {
  if (!pool) return;
  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO app_data (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  } catch (err) {
    console.error(`[cloudStore] "${key}" 백업 실패:`, err.message);
  }
}

// 서버 시작 시 한 번씩 호출합니다. Postgres에 저장된 값이 있으면 돌려주고,
// 없으면(그 key로 백업된 적이 없으면) null을 돌려줍니다.
async function pull(key) {
  if (!pool) return null;
  try {
    await ensureTable();
    const res = await pool.query(`SELECT value FROM app_data WHERE key = $1`, [key]);
    if (res.rows.length === 0) return null;
    return res.rows[0].value;
  } catch (err) {
    console.error(`[cloudStore] "${key}" 복원 실패:`, err.message);
    return null;
  }
}

module.exports = { push, pull, pushFile, pullAllFiles, isEnabled: Boolean(pool) };
