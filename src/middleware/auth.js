"use strict";

const sessionStore = require("../sessionStore");

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

// 로그인한 사용자만 통과시킵니다. 통과하면 req.user에 { id, username, name, role }가 채워집니다.
function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  const user = token ? sessionStore.getSession(token) : null;
  if (!user) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  req.user = user;
  next();
}

// 로그인 + 관리자(role === 'admin')인 사용자만 통과시킵니다.
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "관리자만 사용할 수 있습니다." });
    }
    next();
  });
}

// 로그인 + 교사(role === 'teacher')인 사용자만 통과시킵니다.
function requireTeacher(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ error: "교사 계정만 사용할 수 있습니다." });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireTeacher, getTokenFromHeader };
