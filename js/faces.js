// 몽타주 얼굴을 절차적으로 생성한다.
// 얼굴은 "슬롯 -> variant 인덱스" 형태의 순수 객체(descriptor)이고,
// renderFaceSvg()가 이를 흑백 스케치 SVG 문자열로 렌더한다.

// 슬롯 순서 = SVG 그리기 순서(z-order) = 신원 비교 순서.
export const SLOTS = [
  { id: "face", count: 3 },
  { id: "hair", count: 4 },
  { id: "brow", count: 3 },
  { id: "eyes", count: 3 },
  { id: "glasses", count: 3 },
  { id: "nose", count: 3 },
  { id: "mouth", count: 3 },
  { id: "beard", count: 3 },
  { id: "mark", count: 3 },
];

const DISTRACTOR_COUNT = 2;
const MIN_DIFF_SLOTS = 2;
const MAX_DIFF_SLOTS = 3;
const MAX_ATTEMPTS = 50;

// 서로 가리면 안 되는 규칙:
// - 안경 렌즈는 fill="none" (눈이 렌즈 아래로 계속 보여야 한다)
// - 턱수염은 입 아래에만 그린다 (입 모양을 덮으면 서로 다른 얼굴이 같게 보인다)
// - 머리는 눈썹 위에서 끝난다
const SVG_PARTS = {
  face: [
    '<ellipse cx="60" cy="70" rx="29" ry="37"/>',
    '<path d="M31 48c0-14 13-22 29-22s29 8 29 22v26c0 18-13 32-29 32S31 92 31 74z"/>',
    '<ellipse cx="60" cy="72" rx="24" ry="42"/>',
  ],
  hair: [
    '<path d="M32 50c2-20 13-28 28-28s26 8 28 28c-5-12-15-16-28-16s-23 4-28 16z" fill="#2b2b2b"/>',
    '<path d="M32 48c1-19 13-27 28-27s27 8 28 27c-6-11-13-15-20-16-3 8-14 12-36 16z" fill="#2b2b2b"/>',
    '<path d="M30 46a10 10 0 0 1 6-16 12 12 0 0 1 10-8 14 14 0 0 1 28 0 12 12 0 0 1 10 8 10 10 0 0 1 6 16c-6-12-16-16-30-16s-24 4-30 16z" fill="#2b2b2b"/>',
    '<path d="M33 46c1-14 8-21 18-22-4 6-6 12-6 20zM87 46c-1-14-8-21-18-22 4 6 6 12 6 20z" fill="#2b2b2b"/>',
  ],
  brow: [
    '<path d="M40 57h15M65 57h15"/>',
    '<path d="M40 54l15 5M80 54l-15 5"/>',
    '<path d="M40 59l15-6M80 59l-15-6"/>',
  ],
  eyes: [
    '<circle cx="47" cy="70" r="2.5" fill="#2b2b2b"/><circle cx="73" cy="70" r="2.5" fill="#2b2b2b"/>',
    '<circle cx="47" cy="70" r="5.5"/><circle cx="73" cy="70" r="5.5"/><circle cx="47" cy="70" r="2" fill="#2b2b2b"/><circle cx="73" cy="70" r="2" fill="#2b2b2b"/>',
    '<path d="M41 70q6-5 12 0M67 70q6-5 12 0"/>',
  ],
  glasses: [
    "",
    '<circle cx="47" cy="70" r="10" fill="none"/><circle cx="73" cy="70" r="10" fill="none"/><path d="M57 70h6"/>',
    '<path d="M36 63h22v14H36zM62 63h22v14H62z" fill="none" stroke-width="2.5"/><path d="M58 69h4"/>',
  ],
  nose: [
    '<path d="M60 76v9q0 3 4 3"/>',
    '<path d="M58 74c4 6 7 10 4 14-2 3-6 3-8 1"/>',
    '<path d="M60 76v9M54 88q6 4 12 0"/>',
  ],
  mouth: [
    '<path d="M48 99h24"/>',
    '<path d="M47 96q13 10 26 0"/>',
    '<path d="M47 101q13-9 26 0"/>',
  ],
  beard: [
    "",
    '<path d="M50 92q10-5 20 0" stroke-width="3"/>',
    '<path d="M46 106q14 14 28 0"/>',
  ],
  mark: [
    "",
    '<circle cx="41" cy="86" r="2.5" fill="#2b2b2b"/>',
    '<path d="M78 48l6 12"/>',
  ],
};

// 얼굴을 문자열 하나로 직렬화해 동일 여부/정답 판정에 쓴다.
export function keyOf(descriptor) {
  return SLOTS.map((slot) => descriptor[slot.id]).join("-");
}

export function renderFaceSvg(descriptor) {
  const parts = SLOTS.map((slot) => SVG_PARTS[slot.id][descriptor[slot.id]]).join("");
  return (
    '<svg viewBox="0 0 120 150" class="face-svg" aria-hidden="true" focusable="false">' +
    '<rect x="0" y="0" width="120" height="150" fill="#f7f4ec"/>' +
    '<g fill="none" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    parts +
    "</g></svg>"
  );
}

function randomDescriptor(rng) {
  const descriptor = {};
  SLOTS.forEach((slot) => {
    descriptor[slot.id] = Math.floor(rng() * slot.count);
  });
  return descriptor;
}

// base에서 서로 다른 n개 슬롯을 골라 각각 "반드시 다른" variant로 바꾼다.
// 바뀐 슬롯이 원래 값과 같아질 수 없으므로 base와의 해밍 거리가 정확히 n이 된다.
function mutate(base, n, rng) {
  const out = { ...base };
  const pool = SLOTS.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    const { id, count } = pool[i];
    out[id] = (base[id] + 1 + Math.floor(rng() * (count - 1))) % count;
  }
  return out;
}

// 재시도가 계속 충돌할 때(확률적으로는 거의 불가능) 쓰는 확정 경로.
// 해밍 거리 2를 유지한 채 아직 쓰이지 않은 조합을 순서대로 찾는다.
function firstUnusedPair(target, seen) {
  for (let i = 0; i < SLOTS.length; i++) {
    for (let j = i + 1; j < SLOTS.length; j++) {
      for (let vi = 1; vi < SLOTS[i].count; vi++) {
        for (let vj = 1; vj < SLOTS[j].count; vj++) {
          const candidate = { ...target };
          candidate[SLOTS[i].id] = (target[SLOTS[i].id] + vi) % SLOTS[i].count;
          candidate[SLOTS[j].id] = (target[SLOTS[j].id] + vj) % SLOTS[j].count;
          if (!seen.has(keyOf(candidate))) return candidate;
        }
      }
    }
  }
  return null;
}

function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 목표 얼굴 1명 + 특징 2~3개만 다른 오답 2명을 만들어 섞어서 돌려준다.
export function makeRound(rng = Math.random) {
  const target = randomDescriptor(rng);
  const targetKey = keyOf(target);
  const seen = new Set([targetKey]);
  const distractors = [];
  let attempts = 0;

  while (distractors.length < DISTRACTOR_COUNT) {
    const diffSlots =
      MIN_DIFF_SLOTS + Math.floor(rng() * (MAX_DIFF_SLOTS - MIN_DIFF_SLOTS + 1));
    let candidate = mutate(target, diffSlots, rng);

    if (seen.has(keyOf(candidate))) {
      attempts += 1;
      if (attempts < MAX_ATTEMPTS) continue;
      candidate = firstUnusedPair(target, seen);
      if (candidate === null) break;
    }

    seen.add(keyOf(candidate));
    distractors.push(candidate);
  }

  return { faces: shuffle([target, ...distractors], rng), targetKey };
}
