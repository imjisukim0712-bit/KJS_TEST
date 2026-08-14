import { saveScore, getTop } from "./db.js";

const RANKING_SIZE = 5;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 4000;
const DECOY_DURATION_MS = 350;
const DECOY_MIN_DELAY_FOR_FLASH = 1500;
const DECOY_PROBABILITY = 0.6;
const BEST_MS_KEY = "reactionGame.bestMs";

const TIERS = [
  { name: "챌린저", maxMs: 150, className: "tier-challenger", flavor: "챌린저! 프로게이머급 반응속도입니다" },
  { name: "그랜드마스터", maxMs: 180, className: "tier-grandmaster", flavor: "그랜드마스터! 손이 눈보다 빠름" },
  { name: "마스터", maxMs: 210, className: "tier-master", flavor: "마스터급 반응속도!" },
  { name: "다이아몬드", maxMs: 240, className: "tier-diamond", flavor: "다이아몬드! 진짜 빠름" },
  { name: "에메랄드", maxMs: 270, className: "tier-emerald", flavor: "에메랄드! 상위권 반응속도" },
  { name: "플래티넘", maxMs: 300, className: "tier-platinum", flavor: "플래티넘, 꽤 빠른 편" },
  { name: "골드", maxMs: 350, className: "tier-gold", flavor: "골드! 준수한 반응속도" },
  { name: "실버", maxMs: 400, className: "tier-silver", flavor: "실버, 평범한 반응속도" },
  { name: "브론즈", maxMs: 500, className: "tier-bronze", flavor: "브론즈, 연습이 필요해요" },
  { name: "아이언", maxMs: Infinity, className: "tier-iron", flavor: "아이언... 반응속도 랭크 다시 도전!" },
];

function getTier(ms) {
  return TIERS.find((tier) => ms < tier.maxMs) ?? TIERS[TIERS.length - 1];
}

const STREAK_CALLOUTS = {
  2: "더블킬!",
  3: "트리플킬!",
  4: "쿼드라킬!",
  5: "펜타킬!!",
};

function getStreakCallout(streak) {
  if (streak < 2) return "";
  if (streak >= 6) return `리젠드리! ${streak}연속 성공`;
  return STREAK_CALLOUTS[streak];
}

const els = {
  screen: document.getElementById("game-screen"),
  views: {
    idle: document.getElementById("idle-view"),
    waiting: document.getElementById("waiting-view"),
    ready: document.getElementById("ready-view"),
    fail: document.getElementById("fail-view"),
    result: document.getElementById("result-view"),
  },
  startBtn: document.getElementById("start-btn"),
  restartBtn: document.getElementById("restart-btn"),
  retryBtn: document.getElementById("retry-btn"),
  saveForm: document.getElementById("save-form"),
  saveBtn: document.getElementById("save-btn"),
  nicknameInput: document.getElementById("nickname-input"),
  resultMs: document.getElementById("result-ms"),
  streakCallout: document.getElementById("streak-callout"),
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
let timerId = null;
let decoyTimerId = null;
let decoyEndTimerId = null;
let redAt = 0;
let lastMs = null;
let successStreak = 0;

function setState(next) {
  state = next;
  els.screen.className = `screen screen-${next}`;
  Object.entries(els.views).forEach(([name, view]) => {
    view.classList.toggle("hidden", name !== next);
  });
}

function startWaiting() {
  clearTimeout(timerId);
  clearTimeout(decoyTimerId);
  clearTimeout(decoyEndTimerId);
  setState("waiting");

  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  if (delay > DECOY_MIN_DELAY_FOR_FLASH && Math.random() < DECOY_PROBABILITY) {
    const decoyAt = DECOY_DURATION_MS + Math.random() * (delay - DECOY_DURATION_MS * 2);
    decoyTimerId = setTimeout(() => {
      els.screen.classList.add("is-decoy");
      decoyEndTimerId = setTimeout(() => els.screen.classList.remove("is-decoy"), DECOY_DURATION_MS);
    }, decoyAt);
  }

  timerId = setTimeout(() => {
    redAt = performance.now();
    setState("ready");
  }, delay);
}

function handleScreenClick() {
  if (state === "waiting") {
    clearTimeout(timerId);
    clearTimeout(decoyTimerId);
    clearTimeout(decoyEndTimerId);
    successStreak = 0;
    setState("fail");
  } else if (state === "ready") {
    lastMs = Math.round(performance.now() - redAt);
    successStreak += 1;
    showResult();
  }
}

async function showResult() {
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

  const callout = getStreakCallout(successStreak);
  els.streakCallout.textContent = callout;
  els.streakCallout.classList.toggle("hidden", callout === "");

  renderIdleTier();
  await refreshRanking();
}

function renderIdleTier() {
  const storedBest = getStoredBest();
  if (storedBest === null) {
    els.idleTier.textContent = "";
    els.idleTier.className = "idle-tier";
    return;
  }
  const tier = getTier(storedBest);
  els.idleTier.textContent = `현재 티어: ${tier.name} (최고기록 ${storedBest}ms)`;
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

els.startBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startWaiting();
});

els.restartBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startWaiting();
});

els.retryBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startWaiting();
});

els.screen.addEventListener("click", handleScreenClick);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("요청 시간이 초과되었습니다.")), ms)),
  ]);
}

els.saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();
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
