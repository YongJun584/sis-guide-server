# SIS LINK 서버

서귀포산업과학고등학교 안내 앱 "SIS LINK"의 백엔드 API 서버입니다.
Node.js(Express) + JSON 파일 저장소로 구성되어 있습니다. (네이티브 모듈 컴파일이 필요한
SQLite 드라이버 대신, 어떤 환경에서도 `npm install`만으로 바로 동작하도록 순수 JS로 구현했습니다.
데이터가 많아지면 추후 실제 DB로 교체하는 것을 권장합니다.)

## 실행 방법

```bash
cd sis-guide-server
npm install
cp .env.example .env
npm start
```

서버가 뜨면 `http://localhost:4000` 에서 아래 API를 사용할 수 있습니다.
(데이터는 `data/departments.json`, `data/facilities.json` 파일로 저장됩니다. 직접 열어서 수정해도 됩니다.)

- `GET /health` - 서버 상태 확인
- `GET /api/departments` - 학과 목록
- `GET /api/departments/:id` - 학과 상세
- `GET /api/facilities` - 시설(건물) 목록 (위도/경도 포함, 카카오맵 마커용)
- `GET /api/facilities/:id` - 시설 상세

서버를 처음 실행하면 `data/*.json` 파일이 자동 생성되고, `src/seed.js`의 초기 데이터(학과 6개, 시설 10개)가 자동으로 채워집니다.
데이터를 초기화하고 싶으면 `npm run seed`를 실행하세요.

## 데이터 출처 및 주의사항

- **학과 정보**는 서귀포산업과학고등학교 공식 홈페이지(https://school.jje.go.kr/sis) 학과소개 페이지 내용을 2026년 8월 기준으로 옮긴 것입니다. 학과 개편/내용 변경 시 `src/seed.js`를 직접 수정해야 합니다.
- **시설(건물) 위치의 위도/경도는 확인되지 않은 예시 값(null)입니다.** 실제 캠퍼스 답사 후 카카오맵 앱에서 각 건물 위치를 길게 눌러 좌표를 확인하고 `src/seed.js`의 `facilities` 배열에 채워 넣어야 지도에 정상적으로 마커가 표시됩니다.
- 학과/시설 내용을 수정하려면 `data/departments.json`, `data/facilities.json`을 직접 편집하거나, `src/seed.js`를 고친 뒤 `npm run seed`를 실행하세요. (지금 구조는 로그인 없는 조회용 API만 있고, 수정용 관리자 API는 포함되어 있지 않습니다 - 필요하면 추가로 요청해주세요.)

## 앱(Flutter)에서 연결하기

- 안드로이드 에뮬레이터에서는 `http://localhost:4000` 대신 `http://10.0.2.2:4000` 으로 접속해야 PC의 서버에 연결됩니다.
- 실제 기기로 테스트할 경우, 같은 Wi-Fi에 연결한 뒤 PC의 사설 IP(예: `http://192.168.0.5:4000`)를 사용하세요.
- 배포 시에는 실제 서버(클라우드 등)에 올리고 그 주소를 사용하면 됩니다.
