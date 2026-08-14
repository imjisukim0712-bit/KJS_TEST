import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// 몽타주 게임 전용 컬렉션. 예전 반응속도 게임 기록(scores)과 섞이지 않게 분리했다.
const SCORES_COLLECTION = "montageScores";

// 반응 시간 기록을 Firestore에 저장한다.
export async function saveScore(nickname, ms) {
  await addDoc(collection(db, SCORES_COLLECTION), {
    nickname,
    ms,
    createdAt: serverTimestamp(),
  });
}

// 반응 시간이 짧은 순으로 상위 n개 기록을 가져온다.
export async function getTop(n) {
  const q = query(collection(db, SCORES_COLLECTION), orderBy("ms", "asc"), limit(n));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}
