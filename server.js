require("dotenv").config();
const os = require("os");
const qrcode = require("qrcode-terminal");
const app = require("./src/app");
const seed = require("./src/seed");

const PORT = process.env.PORT || 4000;

// 비어있는 데이터(학과/시설/작품/계정)만 골라서 채웁니다. 이미 채워둔 데이터(예: 직접
// 입력한 시설 좌표)는 건드리지 않습니다.
seed.seedMissing();

// 이 PC에 연결된 네트워크 인터페이스 중 내부(loopback)가 아닌 IPv4 주소를 찾습니다.
// 휴대폰 앱의 apiBaseUrl에는 이 중 실제 Wi-Fi에 연결된 주소를 넣어야 합니다.
// 확실하지 않음: 인터페이스 이름만 보고 "이게 Wi-Fi다"라고 자동으로 골라내지는
// 못하므로(가상 어댑터, 이더넷 등도 함께 잡힐 수 있음) 전부 나열해서 보여줍니다.
function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, ifaceList] of Object.entries(interfaces)) {
    for (const iface of ifaceList ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  return addresses;
}

app.listen(PORT, () => {
  const lanAddresses = getLanAddresses();

  console.log(`SIS LINK 서버 실행 중 (포트 ${PORT})`);
  console.log("");
  if (lanAddresses.length === 0) {
    console.log("⚠ Wi-Fi 등 외부에서 접속 가능한 네트워크 주소를 찾지 못했습니다.");
    console.log(`  일단 로컬에서만 접속하세요: http://localhost:${PORT}`);
  } else {
    console.log("같은 Wi-Fi에 연결된 휴대폰에서 접속할 주소 (apiBaseUrl에 넣으세요):");
    lanAddresses.forEach(({ name, address }) => {
      console.log(`  http://${address}:${PORT}   [인터페이스: ${name}]`);
    });
    console.log("  (여러 개가 보이면 실제로 Wi-Fi에 연결된 어댑터의 주소를 사용하세요.)");
  }
  console.log("");
  console.log(`- 학과 목록:  http://localhost:${PORT}/api/departments`);
  console.log(`- 시설 목록:  http://localhost:${PORT}/api/facilities`);
  console.log(`- 작품 목록:  http://localhost:${PORT}/api/works`);
  console.log(`- 로그인:     POST http://localhost:${PORT}/api/auth/login`);
  console.log("");
  console.log("기본 계정 (seed.js에 정의된 것 - 회원가입으로 새로 만든 계정은 여기 안 뜹니다):");
  seed.defaultCredentials.forEach(({ label, username, password, role }) => {
    console.log(`  [${label} / ${role}] 아이디: ${username}  비밀번호: ${password}`);
  });
  console.log("");

  // 손님용 웹사이트(앱 설치 불필요) - QR로 찍으면 바로 열립니다.
  // 같은 Wi-Fi에 연결된 폰이어야 접속됩니다(교내 행사용). 외부 인터넷에서 접속하려면
  // 별도의 배포(예: render.yaml로 배포)가 필요합니다 - 확실하지 않음/현재 미확인.
  const siteHost = lanAddresses[0]?.address;
  if (siteHost) {
    const siteUrl = `http://${siteHost}:${PORT}/site`;
    console.log(`손님용 웹사이트(학과소개/작품갤러리, 설치 불필요): ${siteUrl}`);
    console.log("아래 QR코드를 폰 카메라로 스캔하면 바로 접속됩니다:");
    qrcode.generate(siteUrl, { small: true });
  } else {
    console.log(`손님용 웹사이트: http://localhost:${PORT}/site (같은 Wi-Fi 주소를 못 찾아 QR은 생략합니다)`);
  }
  console.log("");
  console.log("들어오는 요청은 아래에 실시간으로 표시됩니다:");
});
