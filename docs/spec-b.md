# 세부 개발 사양서 [트랙 B] — AWS 백엔드 + 하이브리드 모바일앱 (v1.0)

> Kiro 스펙 입력 시 참조하는 구현 기준. 앱 UX·연동 상세는 `spec-app-ux.md`,
> 계약은 `event-contract.md` / `push-policy.md` / `network-modes.md`.

## 1. CDK 스택 구성 (TypeScript 1스택 `SafegaiStack`)

콘솔 수작업은 Firebase 키 등록뿐이다.

| 리소스 | 구성 |
|---|---|
| IoT Core | Thing gw-01 + 인증서·정책(발행 safegai/*), Rule r_events: `SELECT * FROM 'safegai/+/gw/+/evt/#'` → fnIngest |
| IoT 생명주기 | Rule r_presence: `$aws/events/presence/disconnected/+` → fnIngest(오프라인 FAULT) |
| DynamoDB | events·devices 2테이블. 온디맨드, PITR |
| Lambda | fnIngest·fnEscalate·fnApi. Node 20, 각 256MB/30s |
| EventBridge | Scheduler 1분 rate → fnEscalate |
| API Gateway | HTTP API + Cognito JWT authorizer → fnApi |
| Cognito | UserPool + 그룹 4(admin·teacher·operator·maintainer) |
| CloudWatch | Lambda Errors≥1 5분 경보 → SNS 이메일 |
| Secrets Manager | FCM 서비스 계정 키 |

## 2. DynamoDB 테이블

### 2.1 events

```
PK: eventId (S)                      // 멱등 키
속성: siteId, deviceId, eventType, severity, title, message, location,
      occurredAt, currentValue, unit, status(OPEN|ACKED|IN_PROGRESS|RESOLVED),
      ack{by,at}, assignee{userId,at}, resolve{by,at,note},
      lastPushAt, expireAt(TTL=90일)
GSI1: gsiSite=siteId, gsiTime=occurredAt      // 목록(최신순)
GSI2: gsiOpen=siteId#OPEN, gsiTime            // 미해결·에스컬레이션
```

### 2.2 devices

```
PK: deviceId (S)  // gw-01, FG-01 ...
속성: siteId, kind, online(bool), lastSeenAt, lastStatus(raw)
갱신: status 토픽·생명주기 이벤트 수신 시 fnIngest가 upsert
```

### 2.3 users (푸시 토큰)

```
PK: userId (Cognito sub)
속성: role, siteIds[], fcmTokens[](기기별), notifyPrefs{}
등록/해제: fnApi POST/DELETE /push/token
```

## 3. Lambda 3종 로직 (의사코드)

### 3.1 fnIngest — 이벤트 처리 (유일한 핵심 코드)

```
input: IoT Rule(evt JSON) 또는 생명주기(disconnected)
if 생명주기: evt = FAULT('GATEWAY_OFFLINE', deviceId=thing) 생성
1) validate(event-contract 필수 필드) → 실패 시 DLQ 로그
2) put events (ConditionExpression: attribute_not_exists(eventId))
   → 이미 있으면 '재전송': 조치 필드 보존, currentValue만 갱신, 푸시 안 함
3) devices upsert(lastSeenAt)
4) 푸시 판단:
   if severity in (DANGER,WARNING) and status==OPEN:
     if now-occurredAt > 10min: skip(재전송 폭주 방지, pendingSummary+=1)
     else: sendFCM(대상=siteId 구독자 역할 필터, 등급 채널)
   if FAULT: 대상=admin+maintainer
5) pendingSummary>0 이고 5분 경과 → '밀린 위험 n건' 요약 1건
```

### 3.2 fnEscalate — 1분 주기

```
query GSI2(siteId#OPEN, severity=DANGER)
for e in 미확인: age = now - occurredAt
  if age≥1min and !e.esc1: push(teacher)          esc1=t
  if age≥3min and !e.esc2: push(admin)            esc2=t
  if age≥5min and !e.esc3: push(전 관리자·책임자)  esc3=t
ACKED 시 중지. 시간값은 env로 조정
```

### 3.3 fnApi — REST 핸들러

JWT 그룹으로 권한 검사(4장) → DynamoDB 조회/갱신. 모든 갱신에 who(sub)·when.
조건부 갱신으로 상태 역행 금지(RESOLVED→ACKED 불가).

## 4. REST API 명세와 권한

| 엔드포인트 | 메서드 | 요지 | 권한 |
|---|---|---|---|
| /events | GET | ?status&severity&limit&cursor → GSI1 최신순 | 전 역할 |
| /events/{id} | GET | 단건 상세 | 전 역할 |
| /events/{id}/ack | POST | ack 기록, 에스컬레이션 중지 | teacher↑ |
| /events/{id}/assign | POST | {userId} → assignee | admin(본인 지정은 teacher↑) |
| /events/{id}/resolve | POST | {note?} → RESOLVED | assignee·admin |
| /site/state | GET | devices 요약+미해결 수 | 전 역할 |
| /push/token | POST/DELETE | 토큰 등록/해제 | 본인 |
| /push/test | POST | 본인 기기 테스트 푸시 | 본인 |

공통 응답 `{ ok, data | error{code,msg} }`. 4xx 코드: AUTH_DENIED·NOT_FOUND·STATE_CONFLICT.
페이지 20건.

## 5. FCM 페이로드·딥링크

`push-policy.md` 4장을 그대로 구현(notification+data 병행, 등급 채널, eventId 재조회).

## 6. 모바일앱 화면-API 바인딩 (M1~M8)

| ID | 화면 | 호출 API | 비고 |
|---|---|---|---|
| M1 | 로그인 | Cognito 인증 → POST /push/token | 토큰 재등록·이전 기기 해제 |
| M2 | 홈 | GET /events?limit=5 + GET /site/state (30초) | '현장 지연'=gw online:false |
| M3 | 알림 목록 | GET /events?…cursor | eventId 멱등 갱신·당겨 새로고침 |
| M4 | 알림 상세 | GET /events/{id} | 푸시 딥링크 착지, [확인]→ack |
| M5 | 조치 처리 | POST ack/assign/resolve | 스테퍼=status 매핑 |
| M6 | 오븐/환경 상세 | GET /site/state + 환경 이벤트 | FG-200A 값 |
| M7 | 현장 안전상태 | GET /site/state | 장애=회색 |
| M8 | 설정·내 계정 | POST /push/test, DELETE /push/token | 수신상태=권한+토큰+lastPush |

네트워크 상태머신·오프라인 UI·LOCAL_VIEW WebView는 `network-modes.md`를 코드 기준으로 구현.

## 7. 보안·운영

- 보안: IoT 정책 최소권한(해당 토픽만), API는 Cognito JWT 필수, FCM 키는 Secrets Manager, 개인정보 최소(이름·역할만).
- 모니터링: CloudWatch 대시보드(수신 이벤트/분·푸시 성공률·Lambda 오류), 경보 3종(Ingest 오류·Escalate 미실행·API 5xx).
- 비용: 온디맨드+TTL, 로그 30일, 예산 알림 월 $10. 1개소 예상 월 $1~5.
- 재해복구: `cdk deploy` 전체 재구축, PITR 35일. 리전 ap-northeast-2.
