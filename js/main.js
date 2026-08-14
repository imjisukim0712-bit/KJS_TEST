import { saveScore, getTop } from "./db.js";
import { keyOf, makeRound, renderFaceSvg } from "./faces.js";

const RANKING_SIZE = 5;
const MEMORIZE_MS = 5000;
const BEST_MS_KEY = "montageGame.bestMs";

// 몽타주 게임은 얼굴 기억 + 3지 탐색이라 단순 반응속도보다 훨씬 느리다.
// 티어당 약 1.18배 간격으로 잡아 챌린저가 드물게 나오도록 했다.
const TIERS = [
  { name: "챌린저", maxMs: 600, className: "tier-challenger", flavor: "챌린저! 프로파일러급 식별 능력" },
  { name: "그랜드마스터", maxMs: 720, className: "tier-grandmaster", flavor: "그랜드마스터! 한눈에 알아봤군요" },
  { name: "마스터", maxMs: 850, className: "tier-master", flavor: "마스터급 관찰력!" },
  { name: "다이아몬드", maxMs: 1000, className: "tier-diamond", flavor: "다이아몬드! 베테랑 형사 수준" },
  { name: "에메랄드", maxMs: 1180, className: "tier-emerald", flavor: "에메랄드! 상위권 식별력" },
  { name: "플래티넘", maxMs: 1400, className: "tier-platinum", flavor: "플래티넘, 꽤 예리한 눈" },
  { name: "골드", maxMs: 1650, className: "tier-gold", flavor: "골드! 준수한 관찰력" },
  { name: "실버", maxMs: 2000, className: "tier-silver", flavor: "실버, 평범한 목격자" },
  { name: "브론즈", maxMs: 2500, className: "tier-bronze", flavor: "브론즈, 조금 더 집중해보세요" },
  { name: "아이언", maxMs: Infinity, className: "tier-iron", flavor: "아이언... 다시 도전!" },
];

function getTier(ms) {
  return TIERS.find((tier) => ms < tier.maxMs) ?? TIERS[TIERS.length - 1];
}

const els = {
  screen: document.getElementById("game-screen"),
  views: {
    idle: document.getElementById("idle-view"),
    memorize: document.getElementById("memorize-view"),
    lineup: document.getElementById("lineup-view"),
    fail: document.getElementById("fail-view"),
    result: document.getElementById("result-view"),
  },
  phaseHud: document.getElementById("phase-hud"),
  montageFace: document.getElementById("montage-face"),
  lineupFaces: document.getElementById("lineup-faces"),
  failFaces: document.getElementById("fail-faces"),
  startBtn: document.getElementById("start-btn"),
  restartBtn: document.getElementById("restart-btn"),
  retryBtn: document.getElementById("retry-btn"),
  homeBtn: document.getElementById("home-btn"),
  saveForm: document.getElementById("save-form"),
  saveBtn: document.getElementById("save-btn"),
  nicknameInput: document.getElementById("nickname-input"),
  resultMs: document.getElementById("result-ms"),
  tierBadge: document.getElementById("tier-badge"),
  personalBest: document.getElementById("personal-best"),
  idleTier: document.getElementById("idle-tier"),
  rankingList: document.getElementById("ranking-list"),
  saveStatus: document.getElementById("save-status"),
};

function getStoredBest() {
  try {
    const raw = localStorage.getItem(BEST_MS_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function setStoredBest(ms) {
  try {
    localStorage.setItem(BEST_MS_KEY, String(ms));
  } catch {
    // localStorage를 사용할 수 없으면 개인 최고기록 저장은 건너뛴다.
  }
}

let state = "idle";
let round = null;
let lineupShownAt = 0;
let lastMs = null;
let countdownRafId = null;

function setState(next) {
  state = next;
  els.screen.className = `screen screen-${next}`;
  Object.entries(els.views).forEach(([name, view]) => {
    view.classList.toggle("hidden", name !== next);
  });
}

function stopCountdown() {
  if (countdownRafId !== null) {
    cancelAnimationFrame(countdownRafId);
    countdownRafId = null;
  }
}

function startRound() {
  stopCountdown();
  round = makeRound();
  lastMs = null;

  els.montageFace.innerHTML = renderFaceSvg(round.faces.find((f) => keyOf(f) === round.targetKey));
  setState("memorize");

  // setInterval 누적 오차를 피하려고 종료 시각 하나만 기준으로 삼는다.
  const endAt = performance.now() + MEMORIZE_MS;
  els.phaseHud.classList.remove("hidden");

  const tick = () => {
    const remain = endAt - performance.now();
    if (remain <= 0) {
      countdownRafId = null;
      showLineup();
      return;
    }
    els.phaseHud.textContent = `기억 시간 ${Math.ceil(remain / 1000)}`;
    countdownRafId = requestAnimationFrame(tick);
  };
  tick();
}

// 라인업과 오답 공개 화면이 같은 렌더 함수를 쓴다.
function renderLineup(container, faces, options = {}) {
  const { revealKey = null, wrongIndex = -1, disabled = false } = options;
  container.innerHTML = "";

  faces.forEach((face, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "face-btn";
    btn.setAttribute("aria-label", `용의자 ${index + 1}`);
    btn.innerHTML = renderFaceSvg(face);

    if (revealKey !== null && keyOf(face) === revealKey) btn.classList.add("is-correct");
    if (index === wrongIndex) btn.classList.add("is-wrong");

    if (disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => handleFaceClick(face, index));
    }

    container.appendChild(btn);
  });
}

function showLineup() {
  renderLineup(els.lineupFaces, round.faces);
  els.phaseHud.classList.add("hidden");
  setState("lineup");

  // 첫 페인트 이후를 측정 시작점으로 잡는다.
  requestAnimationFrame(() => {
    lineupShownAt = performance.now();
    const first = els.lineupFaces.querySelector(".face-btn");
    if (first) first.focus();
  });
}

function handleFaceClick(face, index) {
  if (state !== "lineup") return;

  if (keyOf(face) === round.targetKey) {
    finishRound(Math.round(performance.now() - lineupShownAt));
  } else {
    showFail(index);
  }
}

function showFail(wrongIndex) {
  renderLineup(els.failFaces, round.faces, {
    revealKey: round.targetKey,
    wrongIndex,
    disabled: true,
  });
  setState("fail");
}

// 성공 기록이 존재하는 유일한 지점.
async function finishRound(ms) {
  lastMs = ms;
  setState("result");

  els.resultMs.textContent = `${lastMs} ms`;
  els.nicknameInput.value = "";
  els.saveBtn.disabled = false;
  els.saveStatus.textContent = "";

  const storedBest = getStoredBest();
  const isNewRecord = storedBest === null || lastMs < storedBest;
  if (isNewRecord) setStoredBest(lastMs);
  els.resultMs.classList.toggle("new-record", isNewRecord);
  els.personalBest.textContent = isNewRecord
    ? "신기록입니다!"
    : `내 최고기록: ${storedBest} ms`;

  const tier = getTier(lastMs);
  els.tierBadge.textContent = tier.flavor;
  els.tierBadge.className = `tier-badge ${tier.className}`;

  renderIdleTier();
  await refreshRanking();
}

function goToIdle() {
  stopCountdown();
  round = null;
  lastMs = null;
  els.phaseHud.classList.add("hidden");
  setState("idle");
  renderIdleTier();
}

function renderIdleTier() {
  const storedBest = getStoredBest();
  if (storedBest === null) {
    els.idleTier.textContent = "아직 기록이 없습니다";
    els.idleTier.className = "idle-tier";
    return;
  }
  const tier = getTier(storedBest);
  els.idleTier.textContent = `내 티어: ${tier.name} (최고기록 ${storedBest}ms)`;
  els.idleTier.className = `idle-tier ${tier.className}`;
}

function renderRanking(top) {
  els.rankingList.innerHTML = "";
  top.forEach((record) => {
    const li = document.createElement("li");
    const tier = getTier(record.ms);
    const text = document.createElement("span");
    text.textContent = `${record.nickname} - ${record.ms}ms`;
    const tag = document.createElement("span");
    tag.textContent = tier.name;
    tag.className = `tier-tag ${tier.className}`;
    li.appendChild(text);
    li.appendChild(tag);
    els.rankingList.appendChild(li);
  });
}

async function refreshRanking() {
  try {
    const top = await getTop(RANKING_SIZE);
    renderRanking(top);
  } catch (err) {
    console.error("랭킹을 불러오지 못했습니다.", err);
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("요청 시간이 초과되었습니다.")), ms)),
  ]);
}

els.startBtn.addEventListener("click", startRound);
els.restartBtn.addEventListener("click", startRound);
els.retryBtn.addEventListener("click", startRound);
els.homeBtn.addEventListener("click", goToIdle);

els.saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = els.nicknameInput.value.trim() || "익명";
  els.saveBtn.disabled = true;
  els.saveStatus.textContent = "저장 중...";
  try {
    await withTimeout(saveScore(nickname, lastMs), 8000);
    els.saveStatus.textContent = "기록이 저장되었습니다.";
    await refreshRanking();
  } catch (err) {
    console.error("기록 저장에 실패했습니다.", err);
    els.saveStatus.textContent = "저장에 실패했습니다. 다시 시도해주세요.";
    els.saveBtn.disabled = false;
  }
});

setState("idle");
renderIdleTier();
