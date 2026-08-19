// 이메일 인증코드(6자리 숫자)를 만들고 확인하는 아주 단순한 모듈입니다.
//
// 회원가입 이메일 인증 / 비밀번호 재설정에서 씁니다. db.js를 통해
// data/verification_codes.json에 저장되고(+ 외부 DB에도 백업), 서버가
// 재시작돼도 코드가 사라지지 않습니다.
"use strict";

const crypto = require("crypto");
const db = require("../db");

const CODE_TTL_MS = 10 * 60 * 1000; // 인증코드 유효시간: 10분
const RESEND_COOLDOWN_MS = 60 * 1000; // 같은 이메일로 재발송 가능한 최소 간격: 60초

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function cleanup(list) {
  const now = Date.now();
  return list.filter((c) => c.expiresAt > now);
}

// 인증코드를 새로 만들어 저장하고 돌려줍니다.
// purpose: 'register'(회원가입) | 'reset_password'(비밀번호 재설정)
// 같은 이메일+용도로 60초 안에 이미 요청했다면 에러를 던집니다(이메일 폭탄 방지).
function createCode(email, purpose) {
  const normalizedEmail = String(email).trim().toLowerCase();
  let list = cleanup(db.getVerificationCodes());

  const recent = list.find(
    (c) => c.email === normalizedEmail && c.purpose === purpose && Date.now() - c.createdAt < RESEND_COOLDOWN_MS
  );
  if (recent) {
    throw new Error("인증코드를 너무 자주 요청했습니다. 잠시 후 다시 시도해주세요.");
  }

  // 같은 이메일+용도의 예전 코드는 새 코드로 대체합니다.
  list = list.filter((c) => !(c.email === normalizedEmail && c.purpose === purpose));

  const code = generateCode();
  const now = Date.now();
  list.push({ email: normalizedEmail, purpose, code, createdAt: now, expiresAt: now + CODE_TTL_MS });
  db.saveVerificationCodes(list);

  return code;
}

// 인증코드가 맞는지 확인합니다. 맞으면 그 코드를 지우고 true를 돌려줍니다
// (재사용 방지). 틀리거나 만료됐으면 false를 돌려줍니다.
function verifyCode(email, purpose, code) {
  const normalizedEmail = String(email).trim().toLowerCase();
  let list = cleanup(db.getVerificationCodes());

  const idx = list.findIndex(
    (c) => c.email === normalizedEmail && c.purpose === purpose && c.code === String(code ?? "").trim()
  );
  if (idx === -1) {
    db.saveVerificationCodes(list); // 만료된 코드 정리분만 반영
    return false;
  }

  list.splice(idx, 1);
  db.saveVerificationCodes(list);
  return true;
}

module.exports = { createCode, verifyCode };
