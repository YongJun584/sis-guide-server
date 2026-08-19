// Brevo(구 Sendinblue)의 이메일 API로 이메일을 보내는 아주 단순한 모듈입니다.
//
// [중요] 원래는 Gmail SMTP(nodemailer)로 구현했었는데, Render 무료 웹서비스는
// 2025년 9월부터 SMTP 포트(25/465/587)로 나가는 연결을 아예 막아버려서
// (스팸 방지 목적) Gmail SMTP가 항상 타임아웃/연결끊김으로 실패했습니다.
// 그래서 일반 HTTPS API(포트 443, 막혀있지 않음)로 메일을 보내주는
// Brevo(무료: 하루 300통)로 바꿨습니다.
//
// 필요한 환경변수:
//   BREVO_API_KEY   - Brevo 대시보드 > SMTP & API > API Keys 에서 발급
//   MAIL_FROM_EMAIL - 보내는 사람 이메일 (Brevo에 "발신자"로 등록/인증한 주소.
//                     도메인 없이 이메일 하나만으로도 6자리 코드 인증으로 등록 가능)
//   MAIL_FROM_NAME  - 보내는 사람 이름 (생략하면 "SIS LINK")
//
// 두 값(API 키/발신 이메일)이 설정되어 있지 않으면(로컬 개발 등) isEnabled가
// false가 되고, sendMail을 호출해도 실제로 보내지 않고 콘솔에만 남깁니다.
"use strict";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "SIS LINK";

const isEnabled = Boolean(BREVO_API_KEY && MAIL_FROM_EMAIL);

async function sendMail({ to, subject, text }) {
  if (!isEnabled) {
    console.warn(
      `[mailer] BREVO_API_KEY/MAIL_FROM_EMAIL이 설정되지 않아 메일을 실제로 보내지 않았습니다. (to: ${to}, subject: ${subject})`
    );
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: MAIL_FROM_EMAIL, name: MAIL_FROM_NAME },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || JSON.stringify(body);
    } catch (_) {
      // 응답이 JSON이 아니면 무시하고 기본 메시지만 씁니다.
    }
    throw new Error(`Brevo 메일 발송에 실패했습니다. (${res.status}) ${detail}`);
  }
}

module.exports = { sendMail, isEnabled };
