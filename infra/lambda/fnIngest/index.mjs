/**
 * fnIngest — IoT Rule(evt JSON) 또는 생명주기(disconnected) 처리
 *
 * spec-b.md §3.1 의사코드 구현:
 * 1) 생명주기 → FAULT('GATEWAY_OFFLINE') 생성
 * 2) validate(event-contract 필수 필드)
 * 3) put events (멱등: attribute_not_exists)
 *    → 이미 있으면 재전송: currentValue만 갱신, 푸시 안 함
 * 4) devices upsert
 * 5) 푸시 판단 (push-policy 규칙 적용)
 */
import {
  putEventIfNew,
  updateEventCurrentValue,
  upsertDevice,
  getUsersBySite,
} from '../shared/db.mjs';
import { getPushTargetRoles } from '../shared/auth.mjs';
import { sendFcmToUsers } from '../shared/fcm.mjs';

// 필수 필드 (event-contract §1)
const REQUIRED_FIELDS = ['eventId', 'siteId', 'deviceId', 'eventType', 'severity', 'title', 'occurredAt'];
const VALID_SEVERITIES = ['DANGER', 'WARNING', 'FAULT', 'INFO'];

// 밀린 위험 요약 추적 (Lambda 인스턴스 내 메모리 — 콜드스타트 시 리셋)
let pendingSummary = { count: 0, siteId: null, lastFlush: 0 };
const SUMMARY_FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5분
const DELAYED_THRESHOLD_MS = 10 * 60 * 1000; // 10분

export const handler = async (event) => {
  console.log('fnIngest input:', JSON.stringify(event));

  let evt;

  try {
    // ─── 생명주기 이벤트 감지 ──────────────────────────────────────
    if (isLifecycleEvent(event)) {
      evt = buildGatewayOfflineFault(event);
      console.log('Lifecycle → FAULT:', JSON.stringify(evt));
    } else {
      evt = event;
    }

    // ─── 1) 필수 필드 검증 ─────────────────────────────────────────
    const validationError = validateEvent(evt);
    if (validationError) {
      console.error('Validation failed (DLQ log):', validationError, JSON.stringify(evt));
      // DLQ 로그만 남기고 종료 (실제 DLQ는 Lambda 설정으로 처리)
      return { statusCode: 400, body: validationError };
    }

    // ─── 2) events 테이블 삽입 (멱등) ──────────────────────────────
    const { isNew } = await putEventIfNew({
      eventId: evt.eventId,
      siteId: evt.siteId,
      deviceId: evt.deviceId,
      eventType: evt.eventType,
      severity: evt.severity,
      title: evt.title,
      message: evt.message || '',
      location: evt.location || '',
      occurredAt: evt.occurredAt,
      currentValue: evt.currentValue ?? null,
      unit: evt.unit || '',
      status: 'OPEN',
      ack: { by: null, at: null },
      assignee: { userId: null, at: null },
      resolve: { by: null, at: null, note: null },
      lastPushAt: null,
      guide: evt.guide || null,
    });

    // ─── 재전송 처리 ───────────────────────────────────────────────
    if (!isNew) {
      console.log(`Re-transmission: ${evt.eventId} — updating currentValue only, no push`);
      if (evt.currentValue !== undefined) {
        await updateEventCurrentValue(evt.eventId, evt.currentValue);
      }
      // 재전송 시 푸시 발송 금지 (push-policy §2)
      await upsertDevice(evt.deviceId, evt.siteId, true, evt);
      return { statusCode: 200, body: 'duplicate-updated' };
    }

    // ─── 3) devices upsert ─────────────────────────────────────────
    const isOnline = evt.severity !== 'FAULT' || evt.eventType !== 'GATEWAY_OFFLINE';
    await upsertDevice(evt.deviceId, evt.siteId, isOnline, evt);

    // ─── 4) 푸시 판단 ──────────────────────────────────────────────
    await handlePush(evt);

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('fnIngest error:', err);
    throw err;
  }
};

/**
 * IoT 생명주기 이벤트 감지
 */
function isLifecycleEvent(event) {
  // IoT 생명주기 disconnected 이벤트는 clientId, eventType='disconnected' 포함
  return event.eventType === 'disconnected' && event.clientId;
}

/**
 * 생명주기 disconnected → GATEWAY_OFFLINE FAULT 이벤트 생성
 */
function buildGatewayOfflineFault(lifecycle) {
  const deviceId = lifecycle.clientId; // thing name = clientId
  const now = new Date().toISOString();
  return {
    eventId: `EVT-${now.slice(0, 10).replace(/-/g, '')}-GW-${deviceId}-${Date.now()}`,
    siteId: lifecycle.siteId || 'UNKNOWN',
    deviceId,
    eventType: 'GATEWAY_OFFLINE',
    severity: 'FAULT',
    title: '게이트웨이 오프라인',
    message: `${deviceId} 게이트웨이 연결이 끊어졌습니다.`,
    location: '',
    occurredAt: lifecycle.timestamp ? new Date(lifecycle.timestamp).toISOString() : now,
    currentValue: null,
    unit: '',
    status: 'OPEN',
  };
}

/**
 * 필수 필드 검증 (event-contract §2)
 */
function validateEvent(evt) {
  for (const field of REQUIRED_FIELDS) {
    if (!evt[field]) return `Missing required field: ${field}`;
  }
  if (!VALID_SEVERITIES.includes(evt.severity)) {
    return `Invalid severity: ${evt.severity}`;
  }
  return null;
}

/**
 * 푸시 판단 및 발송 (push-policy §1, §2)
 *
 * severity in (DANGER, WARNING) and status==OPEN:
 *   if now-occurredAt > 10min: skip(재전송 폭주 방지, pendingSummary+=1)
 *   else: sendFCM(대상=siteId 구독자 역할 필터, 등급 채널)
 * if FAULT: 대상=admin+maintainer
 * pendingSummary>0 이고 5분 경과 → '밀린 위험 n건' 요약 1건
 */
async function handlePush(evt) {
  const { severity, siteId } = evt;

  // INFO는 앱 내 알림 중심 — 푸시 최소 (스킵)
  if (severity === 'INFO') {
    console.log('INFO event — no push');
    return;
  }

  const targetRoles = getPushTargetRoles(severity);
  // targetRoles가 빈 배열이면 푸시 대상 없음
  if (Array.isArray(targetRoles) && targetRoles.length === 0) return;

  // 지연 수신 체크 (10분 초과)
  const occurredMs = new Date(evt.occurredAt).getTime();
  const nowMs = Date.now();
  const delayMs = nowMs - occurredMs;

  if ((severity === 'DANGER' || severity === 'WARNING') && delayMs > DELAYED_THRESHOLD_MS) {
    // 지연 수신 — 개별 푸시 생략, pendingSummary에 누적
    console.log(`Delayed event (${Math.round(delayMs / 60000)}min) — skipping individual push, adding to summary`);
    pendingSummary.count++;
    pendingSummary.siteId = siteId;

    // 5분 경과 시 요약 발송
    if (nowMs - pendingSummary.lastFlush > SUMMARY_FLUSH_INTERVAL_MS && pendingSummary.count > 0) {
      await sendSummaryPush(siteId, pendingSummary.count);
      pendingSummary.count = 0;
      pendingSummary.lastFlush = nowMs;
    }
    return;
  }

  // 즉시 푸시 발송
  const users = await getUsersBySite(siteId, targetRoles);
  if (users.length === 0) {
    console.log('No push targets for', siteId, 'roles:', targetRoles);
    return;
  }

  const pushType = severity === 'FAULT' ? 'FAULT' : 'EVENT';
  await sendFcmToUsers(users, {
    eventId: evt.eventId,
    siteId: evt.siteId,
    severity: evt.severity,
    type: pushType,
    title: evt.title,
    body: evt.message || evt.title,
    occurredAt: evt.occurredAt,
  });

  console.log(`Push sent: ${evt.eventId} → ${users.length} users`);
}

/**
 * 밀린 위험 n건 요약 푸시
 */
async function sendSummaryPush(siteId, count) {
  const users = await getUsersBySite(siteId, null); // 전체 구독자
  if (users.length === 0) return;

  await sendFcmToUsers(users, {
    eventId: '',
    siteId,
    severity: 'DANGER',
    type: 'SUMMARY',
    title: `밀린 위험 ${count}건`,
    body: `확인이 필요한 위험 이벤트 ${count}건이 있습니다.`,
    occurredAt: new Date().toISOString(),
  });

  console.log(`Summary push sent: ${count} pending events → ${users.length} users`);
}
