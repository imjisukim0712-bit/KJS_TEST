# 반응속도 측정 웹앱

**플레이하기: https://imjisukim0712-bit.github.io/KJS_TEST/**

화면이 파란색에서 빨간색으로 바뀌는 순간부터 클릭까지 걸린 시간(ms)을 측정하는 웹 게임입니다.
프론트엔드는 순수 HTML/CSS/JS로 작성되어 GitHub Pages에 그대로 배포할 수 있고,
기록 저장/조회는 Firebase(Firestore)를 사용합니다.

## 동작 방식

1. "시작" 버튼을 클릭하면 게임이 시작되고 화면이 파란색으로 바뀝니다.
2. 1~12초 사이 무작위 시간이 지나면 화면이 빨간색으로 바뀝니다.
3. 빨간색으로 바뀐 순간부터 클릭까지 걸린 시간을 ms 단위로 측정해 초록색 결과 화면에 표시합니다.
4. 결과 화면에서 닉네임을 입력하고 저장하면 Firestore에 기록이 저장됩니다.
5. 빨간색으로 바뀌기 전에 클릭하면 실패 처리되며, 버튼을 눌러 다시 시작할 수 있습니다.
6. 결과 화면에는 저장된 기록 중 상위 랭킹이 함께 표시됩니다.

## 폴더 구조

```
index.html            게임 화면 마크업
css/style.css         화면별 스타일
js/main.js            게임 상태 전환 로직
js/db.js              saveScore(nickname, ms) / getTop(n) 구현 (Firestore)
js/firebase-config.js 로컬 실행용 플레이스홀더 (배포 시 GitHub Actions가 덮어씀)
firestore.rules        Firestore 보안 규칙 (콘솔에 붙여넣어 사용)
```

## Firebase 설정 방법

1. https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
2. 프로젝트 개요에서 웹 앱(`</>`)을 등록하면 `firebaseConfig` 값이 발급됩니다.
3. 왼쪽 메뉴의 "Firestore Database"에서 데이터베이스를 생성합니다.
4. Firestore "규칙" 탭에 이 저장소의 `firestore.rules` 내용을 붙여넣고 게시합니다.
5. 저장소 Settings > Secrets and variables > Actions에 아래 6개 Repository secret을 등록합니다.
   (값은 1번에서 발급받은 `firebaseConfig`의 각 필드입니다.)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

배포 워크플로우가 빌드 시점에 이 secret 값들로 `js/firebase-config.js`를 생성하므로,
실제 config 값은 저장소 코드에 커밋되지 않습니다. 로컬에서 직접 실행할 때는
`js/firebase-config.js`의 플레이스홀더 값이 사용되어 저장/랭킹 기능만 비활성화된 채로 동작합니다.

## 점수 저장/조회 함수

- `saveScore(nickname, ms)`: 닉네임과 반응 시간을 `scores` 컬렉션에 저장합니다.
- `getTop(n)`: 반응 시간이 짧은 순으로 상위 `n`개 기록을 가져옵니다.

두 함수 모두 `js/db.js`에서 export하며, 게임 로직(`js/main.js`)은 이 두 함수만 사용해 Firestore와 통신합니다.
`js/firebase-config.js`를 아직 채우지 않았거나 네트워크 문제로 Firebase 모듈을 불러오지 못해도,
반응속도 측정 자체는 정상 동작하고 기록 저장/랭킹 조회만 비활성화됩니다.

## 로컬에서 실행하기

빌드 없이 정적 파일이므로 아무 정적 서버로 열면 됩니다.

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## GitHub Pages 배포

1. 저장소 Settings > Pages > Build and deployment > Source를 "GitHub Actions"로 선택합니다. (최초 1회)
2. `main` 브랜치에 push되면 `.github/workflows/deploy.yml` 워크플로우가 자동으로 정적 파일을 배포합니다.
3. 배포 주소: https://imjisukim0712-bit.github.io/KJS_TEST/
