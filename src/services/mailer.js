// Gmail SMTP로 이메일을 보내는 아주 단순한 모듈입니다.
//
// 회원가입 이메일 인증코드 / 아이디 찾기 / 비밀번호 재설정 코드를 보낼 때 씁니다.
//
// 필요한 환경변수:
//   MAIL_USER          - 보내는 사람 Gmail 주소 (예: gma56745940@gmail.com)
//   MAIL_APP_PASSWORD  - 그 계정의 "앱 비밀번호"(일반 로그인 비밀번호 아님).
//                        myaccount.google.com/apppasswords 에서 발급받습니다.
//
// 두 값이 설정되어 있지 않으면(로컬 개발 등) isEnabled가 false가 되고,
// sendMail을 호출하면 실제로 보내지 않고 콘솔에만 남깁니다 - 이메일 기능
// 없이도 나머지 기능 개발/테스트를 계속할 수 있게 하기 위함입니다.
"use strict";

const nodemailer = require("nodemailer");

const MAIL_USER = process.env.MAIL_USER;
const MAIL_APP_PASSWORD = process.env.MAIL_APP_PASSWORD;

let transporter = null;
if (MAIL_USER && MAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: MAIL_USER, pass: MAIL_APP_PASSWORD },
  });
}

const isEnabled = Boolean(transporter);

async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.warn(
      `[mailer] MAIL_USER/MAIL_APP_PASSWORD가 설정되지 않아 메일을 실제로 보내지 않았습니다. (to: ${to}, subject: ${subject})`
    );
    return;
  }
  await transporter.sendMail({
    from: `"SIS LINK" <${MAIL_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendMail, isEnabled };
