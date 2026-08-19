// 국토교통부 TAGO(국가대중교통정보센터) 오픈API 클라이언트.
//
// 참고: bus_alarm_poc 프로젝트(lib/services/tago_bus_service.dart)에서 이미
// 검증된 정류소 조회 방식을 그대로 옮겨왔습니다. 도착정보(getSttnAcctoArvlPrearngeInfoList)
// 쪽은 이 서버에서 새로 추가한 것이라, 파라미터/응답 필드 이름은 공공데이터포털
// 문서를 기준으로 작성했지만 실제 호출 테스트는 아직 못 해봤습니다. 확실하지
// 않음: 개발 환경(샌드박스)에서 apis.data.go.kr으로 나가는 요청이 막혀 있어
// 직접 검증하지 못했습니다 — 실제 서버(사용자 PC)에서 꼭 확인해주세요.
"use strict";

const STOP_BASE = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService";
const ARRIVAL_BASE = "https://apis.data.go.kr/1613000/ArvlInfoInqireService";

function getServiceKey() {
  const key = process.env.TAGO_SERVICE_KEY;
  if (!key) {
    throw new Error("TAGO_SERVICE_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.");
  }
  return key;
}

async function callTago(base, operation, params) {
  const url = new URL(`${base}/${operation}`);
  url.searchParams.set("serviceKey", getServiceKey());
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("_type", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TAGO API 요청 실패 (${response.status})`);
  }

  const json = await response.json();
  const header = json?.response?.header;
  if (!header || header.resultCode !== "00") {
    // 확실하지 않음: 신청은 했지만 아직 승인 대기 중이거나, 서비스가 다른 경우에도
    // 이 위치에서 에러가 납니다. resultMsg를 그대로 노출해서 원인을 파악하기 쉽게 합니다.
    throw new Error(`TAGO API 오류: ${header?.resultMsg ?? "알 수 없는 오류"}`);
  }

  const items = json?.response?.body?.items;
  if (!items || items === "") return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 좌표 근처의 버스정류장을 찾습니다. (BusSttnInfoInqireService - 이미 검증되어 사용 중)
async function findNearbyStops(lat, lng, numOfRows = 20) {
  const items = await callTago(STOP_BASE, "getCrdntPrxmtSttnList", {
    gpsLati: lat,
    gpsLong: lng,
    numOfRows,
  });

  return items
    .map((item) => ({
      cityCode: item.citycode,
      nodeId: item.nodeid,
      nodeName: item.nodenm,
      nodeNo: item.nodeno ?? null,
      latitude: item.gpslati,
      longitude: item.gpslong,
    }))
    .filter((s) => s.cityCode && s.nodeId && s.nodeName);
}

// 정류소의 모든 노선에 대한 도착 예정 정보를 조회합니다.
// (ArvlInfoInqireService - 새로 활용신청이 필요한 서비스. 신청/승인 전에는
// TAGO API 오류가 발생할 수 있습니다.)
async function getStationArrivals(cityCode, nodeId, numOfRows = 20) {
  const items = await callTago(ARRIVAL_BASE, "getSttnAcctoArvlPrearngeInfoList", {
    cityCode,
    nodeId,
    numOfRows,
  });

  return items
    .map((item) => ({
      routeId: item.routeid,
      routeNo: item.routeno,
      routeType: item.routetp ?? null,
      // arrtime: 도착 예정까지 남은 초
      arrivalSeconds: item.arrtime != null ? Number(item.arrtime) : null,
      // arrprevstationcnt: 남은 정류장 수
      remainingStops: item.arrprevstationcnt != null ? Number(item.arrprevstationcnt) : null,
      vehicleType: item.vehicletp ?? null,
    }))
    .filter((a) => a.routeId && a.arrivalSeconds != null);
}

module.exports = { findNearbyStops, getStationArrivals };
