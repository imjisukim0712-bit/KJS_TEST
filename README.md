# 몽타주 - 용의자를 지목하라

**플레이하기: https://imjisukim0712-bit.github.io/KJS_TEST/**

몽타주(용의자 얼굴 스케치)를 5초간 기억한 뒤, 3명의 용의자 중 같은 얼굴을 최대한 빨리 지목하는 웹 게임입니다.
**총 5라운드를 진행하고 평균 기록으로 티어가 결정됩니다.**
프론트엔드는 순수 HTML/CSS/JS로 작성되어 GitHub Pages에 그대로 배포되고, 기록 저장/조회는 Firebase(Firestore)를 사용합니다.

## 동작 방식

1. "수사 시작" 버튼을 누르면 몽타주 한 장이 **5초간** 표시됩니다(화면 상단에 라운드와 남은 시간 표시).
2. 5초가 지나면 **용의자 3명**의 얼굴이 나란히 나타납니다. 이 중 한 명이 몽타주와 동일한 인물입니다.
3. 라인업이 표시된 순간부터 클릭까지 걸린 시간을 ms 단위로 측정합니다.
4. 정답을 맞히면 바로 다음 라운드로 넘어가고, **5라운드를 모두 마치면 평균 기록으로 티어**가 정해집니다.
5. 틀린 얼굴을 클릭하면 **정답이 어느 얼굴이었는지 공개**하고, 그 라운드를 다시 진행합니다(오답 횟수는 결과에 표시).
6. 결과 화면에서 평균 기록·티어·라운드별 기록을 보여주고, 닉네임을 입력해 랭킹에 저장할 수 있습니다.

오답 2명은 정답과 대부분 같은 얼굴이고 **특징 2~3개만** 다르게 생성됩니다(중간 난이도).

## 티어

**5라운드 평균 기록**에 따라 10단계 티어가 부여됩니다. 5초간 특징을 외운 뒤 찾는 방식이라 실제 기록이 꽤 빠르게 나오므로, 상위 티어는 빡빡하게 잡혀 있습니다.

| 티어 | 기준 | 티어 | 기준 |
|---|---|---|---|
| 챌린저 | 320ms 미만 | 플래티넘 | 650ms 미만 |
| 그랜드마스터 | 380ms 미만 | 골드 | 750ms 미만 |
| 마스터 | 440ms 미만 | 실버 | 870ms 미만 |
| 다이아몬드 | 500ms 미만 | 브론즈 | 1000ms 미만 |
| 에메랄드 | 570ms 미만 | 아이언 | 그 이상 |

개인 최고 평균은 브라우저(localStorage)에 저장되어 시작 화면에 내 티어로 표시됩니다.

## 폴더 구조

```
index.html            게임 화면 마크업
css/style.css         화면별 스타일
js/main.js            게임 상태 전환 로직 (idle / memorize / lineup / fail / result)
js/faces.js           몽타주 얼굴 SVG 절차적 생성기
js/db.js              saveScore(nickname, ms) / getTop(n) 구현 (Firestore)
js/firebase-config.js 로컬 실행용 플레이스홀더 (배포 시 GitHub Actions가 덮어씀)
firestore.rules       Firestore 보안 규칙 (콘솔에 붙여넣어 사용)
```

## 얼굴 생성 방식

사이트가 100% 정적이라 외부 이미지를 쓸 수 없으므로, 얼굴은 인라인 SVG로 직접 생성합니다.
얼굴은 9개 슬롯(얼굴형/머리/눈썹/눈/안경/코/입/수염/점·흉터)의 조합이며 총 26,244가지입니다.

오답은 정답을 복제한 뒤 **서로 다른 슬롯 2~3개를 각각 반드시 다른 값으로** 바꿔 만들기 때문에,
정답과 오답이 같아지는 경우가 구조적으로 발생하지 않습니다.

## Firebase 설정 방법

1. https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
2. 프로젝트 개요에서 웹 앱(`</>`)을 등록하면 `firebaseConfig` 값이 발급됩니다.
3. 왼쪽 메뉴의 "Firestore Database"에서 데이터베이스를 생성합니다.
4. Firestore "규칙" 탭에 이 저장소의 `firestore.rules` 내용을 붙여넣고 게시합니다.
   (규칙은 `montageScores` 컬렉션을 대상으로 합니다.)
5. 저장소 Settings > Secrets and variables > Actions에 아래 6개 Repository secret을 등록합니다.
   (값은 1번에서 발급받은 `firebaseConfig`의 각 필드입니다.)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

배포 워크플로우가 빌드 시점에 이 secret 값들로 `js/firebase-config.js`를 생성하므로,
실제 config 값은 저장소 코드에 커밋되지 않습니다.

## 점수 저장/조회 함수

- `saveScore(nickname, ms)`: 닉네임과 기록을 `montageScores` 컬렉션에 저장합니다.
- `getTop(n)`: 기록이 짧은 순으로 상위 `n`개를 가져옵니다.

두 함수 모두 `js/db.js`에서 export하며, 게임 로직(`js/main.js`)은 이 두 함수만 사용해 Firestore와 통신합니다.

## 로컬에서 실행하기

빌드 없이 정적 파일이므로 아무 정적 서버로 열면 됩니다.

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

로컬에서는 `js/firebase-config.js`가 플레이스홀더 값이라 저장/랭킹 기능만 동작하지 않고, 게임 자체는 정상 동작합니다.

## GitHub Pages 배포

1. 저장소 Settings > Pages > Build and deployment > Source를 "GitHub Actions"로 선택합니다. (최초 1회)
2. `main` 브랜치에 push되면 `.github/workflows/deploy.yml` 워크플로우가 자동으로 정적 파일을 배포합니다.
3. 배포 주소: https://imjisukim0712-bit.github.io/KJS_TEST/
