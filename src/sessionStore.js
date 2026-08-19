// 아주 단순한 메모리 기반 로그인 세션 저장소입니다.
// (서버를 재시작하면 초기화됩니다. 실제 서비스로 확장한다면 JWT나
//  Redis 세션 등 제대로 된 방식으로 교체하는 것을 권장합니다.)
"use strict";

const sessions = new Map(); // token -> { id, username, name, role }

function createSession(token, user) {
  sessions.set(token, user);
}

function getSession(token) {
  return sessions.get(token) || null;
}

function destroySession(token) {
  sessions.delete(token);
}

module.exports = { createSession, getSession, destroySession };
