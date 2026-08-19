// SIS GUIDE 손님용 웹사이트 (앱 설치 없이 QR로 접속)
// 학과소개 + 작품갤러리만 다룹니다. 로그인/할일/버스 등은 앱 전용 기능이라 여기 없습니다.
// 같은 서버(app.js)가 이 정적 파일과 /api/departments, /api/works를 함께 서비스하므로
// fetch는 항상 상대 경로(예: '/api/departments')를 씁니다 - CORS/IP 걱정이 없습니다.

const appEl = document.getElementById("app");
const titleEl = document.getElementById("pageTitle");
const backBtn = document.getElementById("backBtn");

backBtn.addEventListener("click", () => history.back());

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linesToBulletList(text) {
  if (!text) return "";
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  return `<ul class="bullet-list">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `요청에 실패했습니다. (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch (_) {
      // 응답이 JSON이 아니면 기본 메시지를 사용합니다.
    }
    throw new Error(message);
  }
  return res.json();
}

function setTitle(text, showBack) {
  titleEl.textContent = text;
  backBtn.hidden = !showBack;
}

function loadingView() {
  appEl.innerHTML = `<div class="state-msg">불러오는 중...</div>`;
}

function errorView(message, retry) {
  appEl.innerHTML = `
    <div class="state-msg">
      불러오지 못했습니다.<br />${escapeHtml(message)}
    </div>
  `;
  if (retry) {
    const btn = document.createElement("button");
    btn.textContent = "다시 시도";
    btn.className = "gallery-btn";
    btn.style.marginTop = "8px";
    btn.addEventListener("click", retry);
    appEl.appendChild(btn);
  }
}

// ── 라우팅 ─────────────────────────────────────────────
// 해시 기반 SPA 라우팅: #/  #/dept/3  #/gallery/3
function parseRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "list" };
  if (parts[0] === "dept" && parts[1]) return { name: "detail", id: Number(parts[1]) };
  if (parts[0] === "gallery" && parts[1]) return { name: "gallery", id: Number(parts[1]) };
  return { name: "list" };
}

async function render() {
  const route = parseRoute();
  window.scrollTo(0, 0);
  if (route.name === "list") return renderList();
  if (route.name === "detail") return renderDetail(route.id);
  if (route.name === "gallery") return renderGallery(route.id);
}

// ── 학과 목록 ─────────────────────────────────────────
async function renderList() {
  setTitle("SIS GUIDE 학과 안내", false);
  loadingView();
  try {
    const departments = await fetchJson("/api/departments");
    if (departments.length === 0) {
      appEl.innerHTML = `<div class="state-msg">등록된 학과 정보가 없습니다.</div>`;
      return;
    }
    appEl.innerHTML = departments
      .map(
        (d) => `
        <a class="card" href="#/dept/${d.id}">
          <div class="card-row">
            <div>
              <h3>${escapeHtml(d.name)}</h3>
              ${d.summary ? `<p>${escapeHtml(d.summary)}</p>` : ""}
            </div>
            <span class="chevron">&rsaquo;</span>
          </div>
        </a>`
      )
      .join("");
  } catch (e) {
    errorView(e.message, renderList);
  }
}

// ── 학과 상세 ─────────────────────────────────────────
async function renderDetail(id) {
  setTitle("학과 상세", true);
  loadingView();
  try {
    const d = await fetchJson(`/api/departments/${id}`);
    appEl.innerHTML = `
      <div class="detail-title">${escapeHtml(d.name)}</div>
      ${d.summary ? `<div class="detail-summary">${escapeHtml(d.summary)}</div>` : ""}
      <a class="gallery-btn" href="#/gallery/${d.id}">🖼 작품 갤러리 보기</a>
      ${d.description ? `<div class="section"><h4>학과 소개</h4><p>${escapeHtml(d.description)}</p></div>` : ""}
      ${d.curriculum ? `<div class="section"><h4>주요 교육 내용</h4>${linesToBulletList(d.curriculum)}</div>` : ""}
      ${d.career ? `<div class="section"><h4>진로/진학/취업</h4>${linesToBulletList(d.career)}</div>` : ""}
    `;
  } catch (e) {
    errorView(e.message, () => renderDetail(id));
  }
}

// ── 작품 갤러리 ────────────────────────────────────────
async function renderGallery(departmentId) {
  setTitle("작품 갤러리", true);
  loadingView();
  try {
    const [works, department] = await Promise.all([
      fetchJson(`/api/works?department_id=${departmentId}`),
      fetchJson(`/api/departments/${departmentId}`).catch(() => null),
    ]);
    if (department) setTitle(`${department.name} 작품 갤러리`, true);

    if (works.length === 0) {
      appEl.innerHTML = `<div class="state-msg">아직 등록된 작품이 없습니다.</div>`;
      return;
    }

    appEl.innerHTML = `<div class="gallery-grid">${works.map((w) => workCardHtml(w)).join("")}</div>`;

    appEl.querySelectorAll(".work-card").forEach((el) => {
      el.addEventListener("click", () => {
        const workId = Number(el.dataset.workId);
        const work = works.find((w) => w.id === workId);
        if (work) openWorkModal(work);
      });
    });
  } catch (e) {
    errorView(e.message, () => renderGallery(departmentId));
  }
}

function workCardHtml(w) {
  const meta = [w.student_name, w.year ? `${w.year}` : null].filter(Boolean).join(" · ");
  const thumb = w.image_url
    ? `<img src="${escapeHtml(w.image_url)}" alt="${escapeHtml(w.title)}" loading="lazy" />`
    : "이미지 없음";
  return `
    <div class="work-card" data-work-id="${w.id}">
      <div class="work-thumb">${thumb}</div>
      <div class="work-info">
        <p class="title">${escapeHtml(w.title)}</p>
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    </div>
  `;
}

function openWorkModal(work) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <button class="modal-close" aria-label="닫기">&times;</button>
      <div class="work-thumb" style="aspect-ratio:4/3;border-radius:12px;margin-bottom:16px;">
        ${work.image_url ? `<img src="${escapeHtml(work.image_url)}" alt="${escapeHtml(work.title)}" />` : "이미지 없음"}
      </div>
      <div class="detail-title" style="font-size:18px;">${escapeHtml(work.title)}</div>
      ${
        work.student_name || work.year
          ? `<div class="detail-summary">${escapeHtml(
              [work.student_name, work.year ? `${work.year}` : null].filter(Boolean).join(" · ")
            )}</div>`
          : ""
      }
      ${work.description ? `<p style="line-height:1.6;">${escapeHtml(work.description)}</p>` : ""}
    </div>
  `;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector(".modal-close").addEventListener("click", () => backdrop.remove());
  document.body.appendChild(backdrop);
}

window.addEventListener("hashchange", render);
render();
