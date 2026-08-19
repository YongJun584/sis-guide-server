"use strict";

// 큐넷(Q-net, 한국산업인력공단) 국가자격 시험일정 조회 서비스.
// 공공데이터포털(data.go.kr) 등록 API: "한국산업인력공단_국가자격 시험일정 조회 서비스"
// https://www.data.go.kr/data/15074408/openapi.do
//
// ※ 중요 - 이 파일은 확실하지 않은 부분이 있습니다 (정직하게 밝혀둡니다):
// 1) 이 API는 인증키(서비스키)가 필요합니다. 서버 .env에 QNET_SERVICE_KEY를
//    넣어야 동작합니다. 발급 방법:
//    ① data.go.kr 회원가입/로그인 → 위 링크에서 "활용신청"
//    ② 마이페이지 > 개발계정에서 "일반 인증키(Decoding)" 복사 → .env에 붙여넣기
//    ※ 이미 TAGO_SERVICE_KEY(버스 API)를 등록해서 쓰고 있다면, 같은 data.go.kr
//      계정의 인증키는 API마다 같은 값을 재사용합니다 - 이 API도 "활용신청"만
//      추가로 하면 TAGO_SERVICE_KEY와 동일한 값을 그대로 써도 될 가능성이 높습니다
//      (다만 100% 확실하지 않으니, 안 되면 이 API로 별도 활용신청을 하고 발급된
//      키를 QNET_SERVICE_KEY에 넣어주세요).
// 2) jmCd(종목코드)는 자격증마다 다른 4자리 숫자인데, 공식적으로 공개된 코드표를
//    찾지 못해 이 서버에서는 임의로 채워넣지 않았습니다. 대신 큐넷 홈페이지에서
//    학생이 직접 확인하도록 안내합니다:
//    q-net.or.kr 접속 → 자격정보 → 국가기술자격 → 종목별 상세정보에서 자격증 검색
//    → 주소창 URL의 "jmCd=" 뒤에 있는 숫자를 그대로 입력하면 됩니다.
//    (예: 정보처리기사 상세정보 페이지 URL에는 jmCd=1320이 붙어 있습니다.)
// 3) 이 API의 정확한 응답 필드명은 실제 서비스키로 호출해보지 못해 100% 검증하지
//    못했습니다. data.go.kr 문서 기준으로 가능성이 높은 필드명들을 아래에서
//    여러 개 후보로 시도하고, 원본 데이터(raw)도 함께 내려주니 화면에서 필요하면
//    raw를 참고해 조정할 수 있습니다.
const BASE_URL = "https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList";

class QnetConfigError extends Error {}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function normalizeRow(row) {
  return {
    round: pick(row, ["implSeq", "qualSeq", "seq", "gubun"]),
    docRegStart: pick(row, ["docRegStartDt", "receiptBeginDt", "docRegStartDate"]),
    docRegEnd: pick(row, ["docRegEndDt", "receiptEndDt", "docRegEndDate"]),
    examDate: pick(row, ["examDt", "testDt", "docExamDt", "examStartDt"]),
    passAnnounceDate: pick(row, ["passDt", "resultDt", "passExamDt"]),
    jmNm: pick(row, ["jmNm", "qualNm"]),
    raw: row,
  };
}

// jmCd(종목코드, 필수), implYy(시행년도, "YYYY", 기본값 올해), qualgbCd(자격구분코드, 선택)
async function getExamSchedule({ jmCd, implYy, qualgbCd }) {
  if (!jmCd) {
    throw new Error("jmCd(큐넷 종목코드)가 필요합니다.");
  }
  const serviceKey = process.env.QNET_SERVICE_KEY;
  if (!serviceKey) {
    throw new QnetConfigError(
      "서버에 QNET_SERVICE_KEY가 설정되어 있지 않습니다. data.go.kr에서 " +
        "\"한국산업인력공단_국가자격 시험일정 조회 서비스\"를 활용신청하고, " +
        "발급받은 인증키를 서버 .env의 QNET_SERVICE_KEY에 넣어주세요."
    );
  }

  const year = implYy || String(new Date().getFullYear());
  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("jmCd", String(jmCd));
  url.searchParams.set("implYy", String(year));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("_type", "json");
  if (qualgbCd) url.searchParams.set("qualgbCd", String(qualgbCd));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`큐넷 API 요청 실패 (HTTP ${response.status})`);
  }
  const json = await response.json();

  // data.go.kr 표준 오류 응답 형태 (인증키 오류 등)
  const header = json?.response?.header;
  if (header && header.resultCode && header.resultCode !== "00") {
    throw new Error(`큐넷 API 오류: ${header.resultMsg ?? header.resultCode}`);
  }

  const items = json?.response?.body?.items?.item ?? json?.body?.items?.item ?? [];
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return list.map(normalizeRow);
}

module.exports = { getExamSchedule, QnetConfigError };
