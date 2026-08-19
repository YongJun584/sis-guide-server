"use strict";

// 나이스(NEIS) 교육정보 개방 포털 - 급식식단정보 오픈API.
// https://open.neis.go.kr/hub/mealServiceDietInfo
//
// 학교 코드는 실제로 schoolInfo API를 호출해서 확인한 값입니다:
// ATPT_OFCDC_SC_CODE=T10(제주특별자치도교육청), SD_SCHUL_CODE=9290060(서귀포산업과학고등학교).
// 이 API는 별도 인증키(KEY) 없이도 호출됩니다(실제로 호출해서 확인함). 사용량이
// 많아지면 나이스 오픈API 포털에서 키를 발급받아 NEIS_API_KEY 환경변수로
// 넣는 걸 권장합니다 - 안 넣으면 그냥 키 없이 호출합니다.
const BASE_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";

const ATPT_OFCDC_SC_CODE = "T10";
const SD_SCHUL_CODE = "9290060";

// 식약처/교육부의 식품알레르기 유발물질 표시 19개 항목 코드표입니다.
// (NEIS 급식 데이터의 DDISH_NM에 "메뉴명 (1.5.9)" 형태로 붙어서 옵니다)
const ALLERGY_NAMES = {
  1: "난류(계란)",
  2: "우유",
  3: "메밀",
  4: "땅콩",
  5: "대두",
  6: "밀",
  7: "고등어",
  8: "게",
  9: "새우",
  10: "돼지고기",
  11: "복숭아",
  12: "토마토",
  13: "아황산류",
  14: "호두",
  15: "닭고기",
  16: "쇠고기",
  17: "오징어",
  18: "조개류(굴·전복·홍합 포함)",
  19: "잣",
};

// "베이컨김치볶음밥 (1.5.9.10)" -> { name: "베이컨김치볶음밥", allergyCodes: [1,5,9,10] }
function parseDish(rawDishLine) {
  const trimmed = rawDishLine.trim();
  const match = trimmed.match(/^(.*?)\s*\(([\d.\s]+)\)\s*$/);
  if (!match) {
    return { name: trimmed, allergyCodes: [] };
  }
  const name = match[1].trim();
  const codes = match[2]
    .split(".")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && ALLERGY_NAMES[n]);
  return { name, allergyCodes: codes };
}

function parseMealRow(row) {
  const dishLines = String(row.DDISH_NM || "")
    .split("<br/>")
    .map((s) => s.trim())
    .filter(Boolean);
  const dishes = dishLines.map(parseDish);
  const allAllergyCodes = Array.from(new Set(dishes.flatMap((d) => d.allergyCodes))).sort((a, b) => a - b);

  return {
    mealType: row.MMEAL_SC_NM ?? null, // 조식/중식/석식
    date: row.MLSV_YMD ?? null,
    calorie: row.CAL_INFO ?? null,
    dishes: dishes.map((d) => ({
      name: d.name,
      allergyCodes: d.allergyCodes,
      allergyNames: d.allergyCodes.map((c) => ALLERGY_NAMES[c]),
    })),
    allergyCodes: allAllergyCodes,
  };
}

// dateYmd: "YYYYMMDD"
async function getMeals(dateYmd) {
  const url = new URL(BASE_URL);
  url.searchParams.set("ATPT_OFCDC_SC_CODE", ATPT_OFCDC_SC_CODE);
  url.searchParams.set("SD_SCHUL_CODE", SD_SCHUL_CODE);
  url.searchParams.set("MLSV_YMD", dateYmd);
  url.searchParams.set("Type", "json");
  if (process.env.NEIS_API_KEY) {
    url.searchParams.set("KEY", process.env.NEIS_API_KEY);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NEIS API 요청 실패 (${response.status})`);
  }
  const json = await response.json();

  // 주말/방학처럼 급식이 없는 날, 또는 오류일 때는 이 형태로 옵니다.
  if (json?.RESULT) {
    if (json.RESULT.CODE === "INFO-200") return [];
    throw new Error(`NEIS API 오류: ${json.RESULT.MESSAGE ?? "알 수 없는 오류"}`);
  }

  const rows = json?.mealServiceDietInfo?.[1]?.row ?? [];
  return rows.map(parseMealRow);
}

module.exports = { getMeals, ALLERGY_NAMES };
