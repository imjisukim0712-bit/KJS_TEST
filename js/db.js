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
const SCORES_COLLECTION = "scores";

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
