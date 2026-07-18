# event-contract — 이벤트 계약 (v1.0 · 동결)

> 게이트웨이(트랙 A) ↔ AWS·앱(트랙 B)이 공유하는 유일한 이벤트 규격.
> **이 파일의 변경은 양 트랙 문서·코드 동시 수정 후에만 허용된다.**

## 1. 이벤트 JSON 스키마

```json
{
  "eventId": "EVT-20260721-000123",
  "siteId": "MAPO-01",
  "deviceId": "OVEN-01",
  "eventType": "OVEN_RESIDUAL_HEAT",
  "severity": "DANGER | WARNING | FAULT | INFO",
  "title": "오븐 잔열 주의",
  "message": "오븐 내부 온도가 72℃입니다.",
  "location": "로터리오븐 전면",
  "occurredAt": "2026-07-21T14:32:10+09:00",
  "currentValue": 72.0,
  "unit": "℃",
  "status": "OPEN | ACKED | IN_PROGRESS | RESOLVED",
  "ack":      { "by": null, "at": null },
  "assignee": { "userId": null, "at": null },
  "resolve":  { "by": null, "at": null, "note": null },
  "guide":    { "field": "작업자 접근 차단", "manager": "냉각 확인" }
}
```

## 2. 규칙

- **eventId**: `EVT-YYYYMMDD-` + 게이트웨이 seq 6자리. 멱등 키이자 딥링크 키.
  동일 eventId 재수신 시 신규 생성 금지 — 기존 항목 갱신(조치 필드는 보존).
- **발행 주체**: 게이트웨이만 이벤트를 생성한다. `status`는 발행 시 항상 `OPEN`
  (조치 상태 전이는 트랙 B 소유).
- **RECOVER**: 위험 조건 해제 시 kind별 `..._RECOVER` INFO 이벤트 1건 발행(쿨다운 무시).
- **ts**: ISO8601 +09:00 고정. NTP 불가 시 `timeSource:"RTC"` 필드 추가.
- **seq**: 게이트웨이 단조 증가(재부팅 후에도 이어짐) — 순서·중복 판단 근거.

## 3. severity → UI 매핑 (고정)

| 등급 | 색상 | 알림 |
|---|---|---|
| DANGER | `#D64545` 빨강 | 강한 알림음(무음 불가 채널) |
| WARNING | `#D8940F` 노랑 | 일반 알림 |
| INFO | `#2E5496` 파랑 | 앱 내 중심(푸시 최소) |
| FAULT | `#6B7280` 회색 | 관리자·유지보수자 대상 |

정상·성공 표시는 `#2E9E6B` 초록. 위 색상은 심각도 표시 전용 — 일반 UI 장식에 사용 금지.

## 4. 상태기계 (1차 PoC 4단계)

```
OPEN → ACKED → IN_PROGRESS → RESOLVED    (역행 금지)
```

- 확인(ack) = teacher 이상. ack 시 에스컬레이션 중지.
- 담당지정(assign) = admin(본인 지정은 teacher 이상).
- 완료(resolve) = assignee 또는 admin. note 선택 입력.
- 모든 전이에 who(userId)·when 기록.

## 5. MQTT 토픽 (게이트웨이 → AWS IoT Core)

```
이벤트 : safegai/{siteId}/gw/{gwId}/evt/{kind소문자}     QoS1
상태   : safegai/{siteId}/gw/{gwId}/status               60초, retain
LWT    : status 토픽에 { online: false }
```
