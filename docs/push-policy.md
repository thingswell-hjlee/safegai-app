# push-policy — 푸시 정책·에스컬레이션 계약 (v1.0 · 동결)

## 1. 등급별 푸시 방식

| 등급 | 예시 | 방식 | 대상 |
|---|---|---|---|
| DANGER | 오븐 위험온도, 복합 접근 | 즉시, 강한 알림(무음 불가 채널) | 사이트 구독자 전체 |
| WARNING | 잔열, 물고임, 장기체류 | 즉시, 일반 알림 | 사이트 구독자 |
| FAULT | 센서 단선, 카메라 오프라인 | 일반 알림 | admin + maintainer만 |
| INFO | 작업완료, 타이머, RECOVER | 앱 내 알림 중심(푸시 최소, 설정에서 끔 가능) | — |

## 2. 중복 방지

- 최초 위험 진입 시 푸시 1회 → 지속 시 5분(설정) 후 재알림.
- 관리자 확인(ACKED) 시 반복 중지. 상태 악화(등급 상승) 시 즉시 재알림.
- 정상 복귀 시 알림/기록.
- 재전송(동일 eventId) 수신 시 푸시 발송 금지.
- `now - occurredAt > 10분`인 지연 수신(오프라인 복구 재전송)은 개별 푸시 생략,
  `pendingSummary`로 모아 "밀린 위험 n건" 요약 1건 발송(5분 경과 시).

## 3. 에스컬레이션 (서버 소유 — 앱은 수신만)

```
미확인 DANGER 기준 (EventBridge 1분 주기):
  1분 경과 → 담당 교사(teacher) 재알림
  3분 경과 → 관리자(admin)
  5분 경과 → 전 관리자·책임자(director)
ACKED 되면 즉시 중지. 시간값은 환경변수(현장 협의로 조정).
```

## 4. FCM 페이로드·딥링크

```json
data: { "eventId", "siteId", "severity",
        "type": "EVENT | ESCALATION | SUMMARY | FAULT",
        "title", "body", "occurredAt" }
```

- **notification + data 병행** 발송(안드로이드 백그라운드 표시 보장. data-only 금지).
- Android 채널 = 등급별(danger=무음 불가·강한음 / warning / fault / info).
- 딥링크: 앱은 `data.eventId`로 `GET /events/{id}` **재조회 후** 상세 표시.
  푸시 payload의 스냅샷을 신뢰하지 않는다(오래된 푸시 오인 방지).
- 미로그인·만료 상태의 딥링크 진입 → 로그인 후 원래 목적지로 리다이렉트.

## 5. 토큰 수명주기

- 등록: 로그인 성공 → FCM 토큰 → `POST /push/token`. 멱등. 마지막 등록 7일 경과 시 재등록.
- 갱신: onTokenRefresh → 재등록.
- 해지: 로그아웃·계정 회수 → `DELETE /push/token`. 무효 토큰은 발송 실패 시 서버가 정리.
- 검증: 설정 화면(M8)에 푸시 상태 표시 + `POST /push/test` 시험 발송 버튼.

## 6. 대전제 (network-modes와 연동)

푸시는 **비보장 전제**로 설계한다. 안전망은 서버 에스컬레이션이며,
FCM 장애 시 앱은 포그라운드 30초 폴링으로 보조한다. FCM만 믿는 설계 금지.
