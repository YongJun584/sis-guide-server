// 초기 데이터 시딩 스크립트
// 학과 정보는 서귀포산업과학고등학교 공식 홈페이지(school.jje.go.kr/sis) 학과소개 페이지(2026.08 확인)를 기반으로 작성했습니다.
// 시설 정보(건물 위치/좌표)는 실제 캠퍼스 배치를 확인하지 못했으므로 예시(placeholder) 값입니다.
// -> 반드시 실제 좌표로 교체해서 사용하세요. (카카오맵 앱/웹에서 학교를 검색 후 각 건물 위치를 길게 눌러 좌표 확인 가능)
"use strict";

const db = require("./db");

const departments = [
  {
    id: 1,
    name: "자영생명산업과",
    short_name: "생명산업과",
    summary: "스마트팜·조경·드론 등 첨단 농생명산업 분야 전문인을 기르는 학과",
    description:
      "선진농업 기술 지식과 기술을 습득하여 농업분야와 농촌사회의 유능한 인재가 되기 위한 자질을 기릅니다. 6차 산업을 선도하는 첨단 스마트팜 운영으로 농업경영자, 스마트팜 구축가, 정원 관리사, 화훼디자이너, 드론 조종사, 중장비 운전원 등 창의적이고 전문적인 농생명산업 분야의 전문인을 양성합니다.",
    curriculum:
      "첨단 스마트팜 운영 실습\n농업용 드론 전문가 양성 과정\n해외연수(선진 농업 국가)\n학교 협동조합 운영을 통한 청년 창업 농업인 양성\n방과후 프로그램을 통한 1인 1자격증 이상 취득",
    career:
      "취업: 농업직 공무원, 공기업(LH 등), 농촌지도사, 조경/드론 관련업체\n진학: 한국농수산대학교, 농업교육과 등 농업/조경/생명과학 관련 학과\n창업: 농업 관련 아이디어를 이용한 창업\n취득 가능 자격증: 종자기능사, 조경기능사, 유기농업기능사, 원예기능사, 화훼장식기능사, 굴삭기운전기능사, 지게차운전기능사, 드론자격증 등",
    image_url: null,
    sort_order: 1,
  },
  {
    id: 2,
    name: "자영말산업과",
    short_name: "말산업과",
    summary: "말(馬)의 고장 제주에서 승마·말 조련 전문인력을 기르는 학과",
    description:
      "말의 고장 제주에서 실무중심 교육을 통해 말 생산, 육성, 조련 분야의 글로벌 인재를 양성하는 것을 목표로 합니다. 2013년 농림축산식품부 지정 '말 산업 전문 인력 양성기관'으로 선정되었으며, 국제규격 실내외 마장 및 원형조련시설을 통해 현장중심 실무교육을 진행합니다.",
    curriculum:
      "한국마사회와 협력한 현장체험실습교육\n국제규격 실내외 마장 및 원형조련시설 실습\n해외 승마연수(프랑스 등)\n말조련사·승마지도사·재활승마지도사 자격증 취득 프로그램",
    career:
      "취업: 국내외 말 트레이닝 목장, 국내외 승마장, 경마장(서울/부산/제주), 말 조련센터, 말 생산 목장\n진학: 제주대학교 동물생명공학과, 한국농수산대학 말산업학과, 제주한라대학교 마사학부, 경북대학교(상주) 말·특수동물학과\n취득 가능 자격증: 기승능력인증제, 승마지도사, 말 조련사, 재활승마지도사, 장제사, 생활스포츠지도사(승마), 축산기능사",
    image_url: null,
    sort_order: 2,
  },
  {
    id: 3,
    name: "인테리어디자인과",
    short_name: "인테리어디자인과",
    summary: "건축·시각·실내 디자인 실무 능력을 기르는 디자인 전문 학과",
    description:
      "창의 융합 역량, 커뮤니케이션 역량, 자기주도적 역량을 바탕으로 디자인 실무 능력을 함양하여 미래 산업현장에 적합한 디자이너를 양성합니다. 디자인일반, 건축도면해석과 제도, 컴퓨터그래픽, NCS시각디자인, NCS실내디자인 등을 배웁니다.",
    curriculum:
      "디자인일반 (디자인의 개요·역사·요소 및 기초 이론)\n건축도면해석과 제도 (건축 CAD, 건축물 구조부 제도)\n컴퓨터그래픽 (인터페이스·디지털 이미지·편집·웹디자인)\nNCS시각디자인 / NCS실내디자인\n전공 심화동아리: 그래픽디자인, 게임개발\n실습실: NCS시각디자인실, NCS실내디자인실, NCS디자인제도실, NCS디자인창작실, 기초디자인실",
    career:
      "취득 가능 자격증: 컴퓨터그래픽스운용기능사, 웹디자인기능사, 정보처리기능사, 광고도장기능사, 건축도장기능사, 전산응용건축제도기능사, 도배기능사, 지게차운전기능사, 굴착기운전기능사, 온수온돌기능사, GTQ, ITQ 등",
    image_url: null,
    sort_order: 3,
  },
  {
    id: 4,
    name: "스마트에너지설비과",
    short_name: "에너지설비과",
    summary: "그린에너지·설비 분야 전문 기술인을 기르는 학과",
    description:
      "스마트에너지와 설비를 융합한 지속 가능한 에너지 및 설비 전문가를 양성합니다. 제주 미래 산업 육성 핵심분야(그린에너지 등)와 연계되어 있으며, 국내 최고 수준의 건설기계(지게차·굴착기·로더·불도저·롤러) 실습장을 운영합니다.",
    curriculum:
      "1학년(기본과정): 온수온돌기능사, 지게차운전기능사, 굴착기운전기능사, ITQ, 제한무선통신기능사\n2학년(전문과정): 에너지관리기능사, 공조냉동기계기능사, 건설기계정비기능사, 로더운전기능사, 롤러운전기능사\n3학년(심화과정): 설비보전기능사, 전기기능사, 신재생에너지발전설비기능사(태양광), 불도저운전기능사, 배관기능사, 피복아크용접기능사",
    career:
      "진학: 기계공학과, 기계공학교육과, 에너지설비과, 특수건설기계공학과 등\n취업: 공무원(제주도청·제주도교육청 등), 발전사 등 공기업, 신재생 에너지 산업 분야 대기업",
    image_url: null,
    sort_order: 4,
  },
  {
    id: 5,
    name: "자동차과",
    short_name: "자동차과",
    summary: "자동차 정비·차체수리·도장 전문 기술인을 기르는 학과",
    description:
      "자동차에 관한 기본지식과 첨단장비를 이용한 자동차정비, 자동차 차체수리, 자동차 페인팅 등 수요자 중심의 맞춤형 실습교육으로 자동차 전문기술을 습득하게 하여 21세기 첨단자동차 산업 분야에 종사할 전문 기술인을 양성합니다.",
    curriculum:
      "주요교과: 자동차와 생활, 건설기계구조 정비, 자동차 차체수리, 전문제도\n기능 영재반: 자동차 정비기능반, 자동차 차체수리기능반, 자동차 페인팅기능반, 기계설계/CAD기능반\n글로벌 숙련기술진흥원 입소교육(자동차페인팅 기초·심화과정)",
    career:
      "취업: 군 부사관, 자동차 정비공장, 자동차 카센터, 자동차용품 판매업, 건설기계정비공장, 건설기계 운전기사, 물류센터 등\n진학: 자동차공학과, 기계공학과, 항공정비학과, 건설기계학과 등\n취득 가능 자격증: 자동차정비기능사, 자동차차체수리기능사, 자동차보수도장기능사, 지게차운전기능사, 굴삭기운전기능사 등",
    image_url: null,
    sort_order: 5,
  },
  {
    id: 6,
    name: "통신전자과",
    short_name: "통신전자과",
    summary: "해군특성화(부사관) 및 통신·전자·전기 전문인력을 기르는 학과",
    description:
      "스마트 사회를 주도할 첨단기술 분야의 통신·전자·전기 관련 교육으로, 해군 정보통신 전문기술 부사관과 전기·전자제품 부품 제조, 전기설비, 통신 장비 설치 및 수리 분야 전문인력을 양성합니다. 해군특성화 과정과 통신전자 과정으로 운영됩니다.",
    curriculum:
      "전공 심화동아리: IT 네트워크 시스템, 클라우드컴퓨팅\n해군 특성화 체험활동: 나라사랑교육, 안보현장 견학, 입소교육, 발대식 등\n다양한 프로그램 운영으로 1인 다(多)자격증 취득 (졸업생 최다 16개 자격증 취득 사례)",
    career:
      "해군특성화과정: 군 특성화고 교육과정 이수 후 해군 부사관 임관, 군복무 중 e-MU 대학 진학 가능\n통신전자과정 진학: 전자공학과, 전기공학과, 신재생에너지공학과, 정보통신공학과 등\n통신전자과정 취업: 공무원, 전기공사 시공, 신재생에너지 산업, 반도체·전자제품 제조, 통신공사\n취득 가능 자격증: 전자기능사, 전기기능사, 승강기기능사, 통신선로기능사, 전파전자통신기능사, 정보기기운용기능사, 정보처리기능사, 제한무선통신사, 드론조종자격 등",
    image_url: null,
    sort_order: 6,
  },
];

// 시설 데이터는 확인되지 않은 예시(placeholder)입니다. 위/경도는 null로 두었으니
// 실제 답사 후 카카오맵에서 좌표를 확인해 채워 넣어야 지도에 마커가 표시됩니다.
const facilities = [
  {
    id: 1,
    name: "본관(행정실/교무실)",
    category: "행정",
    department_id: null,
    latitude: null,
    longitude: null,
    description:
      "서귀포산업과학고등학교 본관. 주소: 제주특별자치도 서귀포시 516로 501 (예시 설명 - 실제 위치로 수정 필요)",
    image_url: null,
    sort_order: 1,
  },
  {
    id: 2,
    name: "심경의 집 (기숙사)",
    category: "기숙사",
    department_id: null,
    latitude: null,
    longitude: null,
    description: "교내 기숙사. 학교 홈페이지 '심경의 집(기숙사)' 메뉴 참고 (좌표 미확인)",
    image_url: null,
    sort_order: 2,
  },
  {
    id: 3,
    name: "자영생명산업과 실습장(스마트팜)",
    category: "실습동",
    department_id: 1,
    latitude: null,
    longitude: null,
    description: "스마트팜/조경 실습 공간 (좌표 미확인)",
    image_url: null,
    sort_order: 3,
  },
  {
    id: 4,
    name: "자영말산업과 마장",
    category: "실습동",
    department_id: 2,
    latitude: null,
    longitude: null,
    description: "국제규격 실내외 마장 및 원형조련시설 (좌표 미확인)",
    image_url: null,
    sort_order: 4,
  },
  {
    id: 5,
    name: "인테리어디자인과 실습동",
    category: "실습동",
    department_id: 3,
    latitude: null,
    longitude: null,
    description: "NCS시각디자인실, NCS실내디자인실 등 (좌표 미확인)",
    image_url: null,
    sort_order: 5,
  },
  {
    id: 6,
    name: "스마트에너지설비과 실습동",
    category: "실습동",
    department_id: 4,
    latitude: null,
    longitude: null,
    description: "건설기계(지게차·굴착기·로더·불도저·롤러) 실습장 (좌표 미확인)",
    image_url: null,
    sort_order: 6,
  },
  {
    id: 7,
    name: "자동차과 실습동",
    category: "실습동",
    department_id: 5,
    latitude: null,
    longitude: null,
    description: "자동차 정비/차체수리/도장 실습장 (좌표 미확인)",
    image_url: null,
    sort_order: 7,
  },
  {
    id: 8,
    name: "통신전자과 실습동",
    category: "실습동",
    department_id: 6,
    latitude: null,
    longitude: null,
    description: "전기·전자·통신 실습장 (좌표 미확인)",
    image_url: null,
    sort_order: 8,
  },
  {
    id: 9,
    name: "급식소",
    category: "급식",
    department_id: null,
    latitude: null,
    longitude: null,
    description: "학생 급식소 (좌표 미확인)",
    image_url: null,
    sort_order: 9,
  },
  {
    id: 10,
    name: "체육관",
    category: "체육",
    department_id: null,
    latitude: null,
    longitude: null,
    description: "실내 체육관 (좌표 미확인)",
    image_url: null,
    sort_order: 10,
  },
];

function seed() {
  db.saveDepartments(departments);
  db.saveFacilities(facilities);
  console.log(`시딩 완료: 학과 ${departments.length}개, 시설 ${facilities.length}개`);
}

if (require.main === module) {
  seed();
}

module.exports = seed;
