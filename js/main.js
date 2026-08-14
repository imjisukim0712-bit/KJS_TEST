let saveScore;
let getTop;
try {
  ({ saveScore, getTop } = await import("./db.js"));
} catch (err) {
  console.error("Firebase 연동 모듈을 불러오지 못했습니다. 게임은 계속 플레이할 수 있지만 기록 저장/조회는 동작하지 않습니다.", err);
  saveScore = async () => {
    throw new Error("Firebase 연동을 불러오지 못했습니다.");
  };
  getTop = async () => [];
}

const RANKING_SIZE = 5;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 12000;

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
  rankingList: document.getElementById("ranking-list"),
  saveStatus: document.getElementById("save-status"),
};

let state = "idle";
let timerId = null;
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
  setState("waiting");
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  timerId = setTimeout(() => {
    redAt = performance.now();
    setState("ready");
  }, delay);
}

function handleScreenClick() {
  if (state === "waiting") {
    clearTimeout(timerId);
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

els.saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const nickname = els.nicknameInput.value.trim() || "익명";
  els.saveBtn.disabled = true;
  try {
    await saveScore(nickname, lastMs);
    els.saveStatus.textContent = "기록이 저장되었습니다.";
    await refreshRanking();
  } catch (err) {
    console.error("기록 저장에 실패했습니다.", err);
    els.saveStatus.textContent = "저장에 실패했습니다. 다시 시도해주세요.";
    els.saveBtn.disabled = false;
  }
});

setState("idle");
