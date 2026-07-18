# Tech — 기술 스택·구조 규칙 (변경은 합의 후)

## 스택 (고정)

- 인프라: **CDK(TypeScript) 1개 스택 `SafegaiStack`**. 콘솔 수작업은 Firebase 키 등록뿐.
- 리소스: IoT Core(Rule 2개: evt/# + 생명주기 disconnected), DynamoDB 온디맨드(events·devices·users, PITR, TTL 90일), Lambda 3개(fnIngest/fnEscalate/fnApi, Node 20, 256MB/30s), EventBridge Scheduler 1분, HTTP API+Cognito JWT authorizer, CloudWatch 경보, Secrets Manager(FCM 키).
- 앱: 하이브리드(Capacitor) + React. 상태관리 **Zustand 3스토어(auth/event/env)** + react-query. Redux 도입 금지.
- 리전 ap-northeast-2. 예산 알림 월 $10.

## 관리형 우선 원칙

직접 코드는 Lambda 3개뿐이다. heartbeat 감시 코드를 직접 쓰지 말 것 —
IoT 생명주기 이벤트(disconnected)를 사용한다. 스케줄링은 EventBridge,
인증은 Cognito, 재알림 상태는 DynamoDB 필드(esc1/2/3)로.

## 구현 기준 문서 (docs/ — 스펙 생성 시 이 문서가 requirements다)

- `docs/spec-b.md` — CDK 리소스·DDL·Lambda 의사코드·API 명세·화면 바인딩
- `docs/spec-app-ux.md` — 디자인 토큰·컴포넌트 8종·상태 UX·인증/캐시/에러/푸시 연동
- `docs/event-contract.md` / `docs/push-policy.md` / `docs/network-modes.md` — 계약(동결)

Kiro가 requirements/design을 생성할 때 이 문서와 다른 내용을 창작하지 않는다.
충돌하면 문서가 이긴다. 계약 3종 수정 금지.

## 코드 규칙

- API 응답 공통 `{ ok, data | error{code,msg} }`. 오류 코드: AUTH_DENIED·NOT_FOUND·STATE_CONFLICT.
- 조건부 쓰기 필수: events put은 attribute_not_exists(eventId), 상태 전이는 역행 금지.
- 색상·문구·사이즈는 spec-app-ux.md의 토큰만 사용. 하드코딩 색상 발견 시 토큰으로 이동.
- 화면 문구·주석은 한국어. 기술 메시지(500, timeout 등)를 사용자에게 노출 금지 — 에러 매핑표 사용.
- 토큰(idToken 등)은 Keychain/Keystore. AsyncStorage 평문 저장 금지. 로그에 토큰·개인정보 금지.
- POST 재시도 금지(멱등키 첨부), GET만 1회 자동 재시도.

## 완료 기준

코드 생성이 아니라 **spec-app-ux.md 8장 B1~B8 시험 통과**. 각 태스크 완료 시
확인 방법(어느 화면에서 무엇을 눌러 무엇이 보여야 하는지)을 명시할 것.
