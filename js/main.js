import { saveScore, getTop } from "./db.js";
import { keyOf, makeRound, renderFaceSvg } from "./faces.js";

const RANKING_SIZE = 5;
const MEMORIZE_MS = 5000;
const ROUNDS_PER_GAME = 5;
// 단판 기록이 아니라 5라운드 평균을 저장하므로 키를 따로 쓴다.
const BEST_AVG_KEY = "montageGame.bestAvgMs";

// 5초간 특징을 미리 외운 상태에서 찾기 때문에 실제 플레이는 예상보다 훨씬 빠르다.
// 사람의 단순 반응 한계(약 250ms)에 판별 시간을 더한 값이 사실상 하한이라,
// 챌린저를 그 하한 근처로 두고 티어당 약 1.15배 간격으로 빡빡하게 잡았다.
const TIERS = [
  { name: "챌린저", maxMs: 320, className: "tier-challenger", flavor: "챌린저! 프로파일러급 식별 능력" },
  { name: "그랜드마스터", maxMs: 380, className: "tier-grandmaster", flavor: "그랜드마스터! 한눈에 알아봤군요" },
  { name: "마스터", maxMs: 440, className: "tier-master", flavor: "마스터급 관찰력!" },
  { name: "다이아몬드", maxMs: 500, className: "tier-diamond", flavor: "다이아몬드! 베테랑 형사 수준" },
  { name: "에메랄드", maxMs: 570, className: "tier-emerald", flavor: "에메랄드! 상위권 식별력" },
  { name: "플래티넘", maxMs: 650, className: "tier-platinum", flavor: "플래티넘, 꽤 예리한 눈" },
  { name: "골드", maxMs: 750, className: "tier-gold", flavor: "골드! 준수한 관찰력" },
  { name: "실버", maxMs: 870, className: "tier-silver", flavor: "실버, 평범한 목격자" },
  { name: "브론즈", maxMs: 1000, className: "tier-bronze", flavor: "브론즈, 조금 더 집중해보세요" },
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
  roundSummary: document.getElementById("round-summary"),
  personalBest: document.getElementById("personal-best"),
  idleTier: document.getElementById("idle-tier"),
  rankingList: document.getElementById("ranking-list"),
  saveStatus: document.getElementById("save-status"),
};

function getStoredBest() {
  try {
    const raw = localStorage.getItem(BEST_AVG_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function setStoredBest(ms) {
  try {
    localStorage.setItem(BEST_AVG_KEY, String(ms));
  } catch {
    // localStorage를 사용할 수 없으면 개인 최고기록 저장은 건너뛴다.
  }
}

let state = "idle";
let round = null;
let lineupShownAt = 0;
let countdownRafId = null;
let roundTimes = [];
let failCount = 0;
let lastAvgMs = null;

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

function roundLabel() {
  return `라운드 ${roundTimes.length + 1}/${ROUNDS_PER_GAME}`;
}

// 5라운드를 새로 시작한다.
function startGame() {
  roundTimes = [];
  failCount = 0;
  lastAvgMs = null;
  startRound();
}

// 다음(또는 실패해서 재시도하는) 라운드를 시작한다. roundTimes는 유지된다.
function startRound() {
  stopCountdown();
  round = makeRound();

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
    els.phaseHud.textContent = `${roundLabel()} · 기억 시간 ${Math.ceil(remain / 1000)}`;
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
  els.phaseHud.textContent = roundLabel();
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
    failCount += 1;
    showFail(index);
  }
}

function showFail(wrongIndex) {
  renderLineup(els.failFaces, round.faces, {
    revealKey: round.targetKey,
    wrongIndex,
    disabled: true,
  });
  els.phaseHud.classList.add("hidden");
  setState("fail");
}

// 라운드 하나를 맞혔을 때. 5라운드가 끝나면 평균으로 결과를 낸다.
function finishRound(ms) {
  roundTimes.push(ms);

  if (roundTimes.length < ROUNDS_PER_GAME) {
    startRound();
    return;
  }

  showGameResult();
}

// 5라운드 평균이 확정되는 유일한 지점.
async function showGameResult() {
  stopCountdown();
  els.phaseHud.classList.add("hidden");
  setState("result");

  const total = roundTimes.reduce((sum, ms) => sum + ms, 0);
  lastAvgMs = Math.round(total / roundTimes.length);

  els.resultMs.textContent = `평균 ${lastAvgMs} ms`;
  els.nicknameInput.value = "";
  els.saveBtn.disabled = false;
  els.saveStatus.textContent = "";

  const storedBest = getStoredBest();
  const isNewRecord = storedBest === null || lastAvgMs < storedBest;
  if (isNewRecord) setStoredBest(lastAvgMs);
  els.resultMs.classList.toggle("new-record", isNewRecord);
  els.personalBest.textContent = isNewRecord
    ? "신기록입니다!"
    : `내 최고 평균: ${storedBest} ms`;

  const tier = getTier(lastAvgMs);
  els.tierBadge.textContent = tier.flavor;
  els.tierBadge.className = `tier-badge ${tier.className}`;

  const failText = failCount > 0 ? ` · 오답 ${failCount}회` : "";
  els.roundSummary.textContent = `라운드 기록: ${roundTimes.join(" / ")} ms${failText}`;

  renderIdleTier();
  await refreshRanking();
}

function goToIdle() {
  stopCountdown();
  round = null;
  roundTimes = [];
  failCount = 0;
  lastAvgMs = null;
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
  els.idleTier.textContent = `내 티어: ${tier.name} (최고 평균 ${storedBest}ms)`;
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

els.startBtn.addEventListener("click", startGame);
// 오답인 라운드는 기록에 넣지 않고 같은 라운드를 다시 진행한다.
els.restartBtn.addEventListener("click", startRound);
els.retryBtn.addEventListener("click", startGame);
els.homeBtn.addEventListener("click", goToIdle);

els.saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = els.nicknameInput.value.trim() || "익명";
  els.saveBtn.disabled = true;
  els.saveStatus.textContent = "저장 중...";
  try {
    await withTimeout(saveScore(nickname, lastAvgMs), 8000);
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
