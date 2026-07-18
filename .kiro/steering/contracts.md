# Contracts — 트랙 A(게이트웨이)와의 동결 계약 요약

> 전문은 docs/event-contract.md · push-policy.md · network-modes.md.
> 여기 요약과 전문이 다르면 전문이 이긴다. **이 계약의 변경은 양 트랙 합의 없이는 금지.**

## 이벤트

- 수신 토픽: `safegai/{siteId}/gw/{gwId}/evt/{kind}` (QoS1) + status 토픽(60초 retain, LWT).
- eventId = `EVT-YYYYMMDD-seq6` — **멱등 키**. 재수신은 갱신(조치 필드 보존, 푸시 금지).
- severity: DANGER/WARNING/FAULT/INFO. status는 게이트웨이 발행 시 항상 OPEN.
- 상태기계: OPEN→ACKED→IN_PROGRESS→RESOLVED, 역행 금지.
- 색상: DANGER #D64545 / WARNING #D8940F / INFO #2E5496 / FAULT #6B7280 / 정상 #2E9E6B.

## 푸시

- DANGER=강한 채널 즉시, WARNING=일반 즉시, FAULT=admin+maintainer, INFO=푸시 최소.
- notification+data 병행. data.eventId로 재조회 후 표시(payload 신뢰 금지).
- 10분 초과 지연 수신은 개별 푸시 생략 → 요약 1건.
- 에스컬레이션(서버 소유): 미확인 DANGER 1분→teacher, 3분→admin, 5분→전체. ACKED 시 중지.

## 네트워크 3상태 (앱)

- ONLINE(전 기능) / LOCAL_VIEW(게이트웨이 :8080 WebView 보기 전용, 조치 버튼 숨김) / ISOLATED(캐시 '이전 정보').
- 판정은 헬스체크만(클라우드 3초→generate_204 구분→게이트웨이). OS 표시·모드 선택 UI 금지.
- AWS 장애는 "서비스 점검 중 — 현장 안전은 정상" 전용 화면(ISOLATED와 구분).
- 게이트웨이 오프라인 감지는 IoT 생명주기 + heartbeat — 앱이 직접 감시하지 않는다.
