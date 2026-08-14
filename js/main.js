import { saveScore, getTop } from "./db.js";

const RANKING_SIZE = 5;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 4000;
const DECOY_DURATION_MS = 350;
const DECOY_MIN_DELAY_FOR_FLASH = 1500;
const DECOY_PROBABILITY = 0.6;
const BEST_MS_KEY = "reactionGame.bestMs";

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
  personalBest: document.getElementById("personal-best"),
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
    setState("fail");
  } else if (state === "ready") {
    lastMs = Math.round(performance.now() - redAt);
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

  await refreshRanking();
}

function renderRanking(top) {
  els.rankingList.innerHTML = "";
  top.forEach((record) => {
    const li = document.createElement("li");
    li.textContent = `${record.nickname} - ${record.ms}ms`;
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
