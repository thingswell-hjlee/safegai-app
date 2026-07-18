# SafeGAI 모바일앱

React Native 0.74.5 bare workflow + TypeScript.

## 사전 준비

1. Node.js 20+
2. JDK 17 (Android)
3. Android SDK (compileSdk 34, buildTools 34.0.0)

## 설치

```bash
cd app
npm install
```

## Firebase 설정

1. Firebase 콘솔에서 Android 앱 등록 (패키지: `kr.co.thingswell.safegai`)
2. `google-services.json` 다운로드
3. `app/android/app/google-services.json`에 배치 (gitignore됨)

## 빌드 (Android)

```bash
cd android
./gradlew :app:assembleDebug
```

또는:

```bash
npx react-native run-android
```

### 빌드 전 확인사항

- `android/app/google-services.json`이 존재하는지
- Android SDK 환경변수 (`ANDROID_HOME`) 설정되어 있는지
- 에뮬레이터 실행 또는 USB 디바이스 연결

## 알림 채널

앱 시작 시 `@notifee/react-native`를 통해 4개 채널이 자동 생성됩니다:

| 채널 ID | 이름 | Importance |
|---------|------|------------|
| `danger_channel` | 위험 알림 | HIGH (무음 불가, 강한 소리) |
| `warning_channel` | 주의 알림 | DEFAULT |
| `fault_channel` | 장애 알림 | DEFAULT |
| `info_channel` | 정보 알림 | LOW |

서버 FCM payload의 `android.notification.channelId`와 매칭됩니다.

## 패키지명

```
kr.co.thingswell.safegai
```

## 프로젝트 구조

```
app/
├── android/          ← 네이티브 Android 프로젝트
├── src/
│   ├── api/          ← axios client, queries, mutations
│   ├── components/   ← UI 컴포넌트
│   ├── navigation/   ← React Navigation
│   ├── push/         ← FCM 푸시 모듈
│   ├── screens/      ← 화면 (M1~M5, M8)
│   ├── stores/       ← Zustand 상태
│   ├── theme/        ← 디자인 토큰
│   └── utils/        ← Amplify, auth, secureStorage
├── App.tsx           ← 앱 루트
├── index.js          ← 엔트리포인트
├── app.json          ← 앱 메타 (이름: SafeGAI)
└── package.json      ← 의존성
```
