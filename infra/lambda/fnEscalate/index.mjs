/**
 * fnEscalate — 1분 주기 에스컬레이션 처리
 *
 * spec-b.md §3.2:
 * query GSI2(siteId#OPEN, severity=DANGER)
 * for e in 미확인: age = now - occurredAt
 *   if age≥1min and !e.esc1: push(teacher)          esc1=t
 *   if age≥3min and !e.esc2: push(admin)            esc2=t
 *   if age≥5min and !e.esc3: push(전 관리자·책임자)  esc3=t
 * ACKED 시 중지. 시간값은 env로 조정
 */
import { scanOpenDangerEvents, markEscalation, getUsersBySite } from '../shared/db.mjs';
import { sendFcmToUsers } from '../shared/fcm.mjs';
import { sendAlertEmail } from '../shared/email.mjs';

// 환경변수로 시간 조정 가능
const ESC1_MS = (parseInt(process.env.ESC1_MINUTES) || 1) * 60 * 1000;
const ESC2_MS = (parseInt(process.env.ESC2_MINUTES) || 3) * 60 * 1000;
const ESC3_MS = (parseInt(process.env.ESC3_MINUTES) || 5) * 60 * 1000;

export const handler = async (event) => {
  console.log('fnEscalate invoked at', new Date().toISOString());

  try {
    // 모든 OPEN + DANGER 이벤트 조회
    const openDangerEvents = await scanOpenDangerEvents();
    console.log(`Found ${openDangerEvents.length} open DANGER events`);

    let escalated = 0;

    for (const evt of openDangerEvents) {
      // ACKED 이상이면 에스컬레이션 중지
      if (evt.status !== 'OPEN') continue;

      const age = Date.now() - new Date(evt.occurredAt).getTime();

      // esc3: 5분 경과, 아직 esc3 안 됨
      if (age >= ESC3_MS && !evt.esc3) {
        await escalateLevel3(evt);
        await markEscalation(evt.eventId, 'esc3');
        escalated++;
      }
      // esc2: 3분 경과, 아직 esc2 안 됨
      else if (age >= ESC2_MS && !evt.esc2) {
        await escalateLevel2(evt);
        await markEscalation(evt.eventId, 'esc2');
        escalated++;
      }
      // esc1: 1분 경과, 아직 esc1 안 됨
      else if (age >= ESC1_MS && !evt.esc1) {
        await escalateLevel1(evt);
        await markEscalation(evt.eventId, 'esc1');
        escalated++;
      }
    }

    console.log(`Escalation complete: ${escalated} events escalated`);
    return { statusCode: 200, body: `escalated: ${escalated}` };
  } catch (err) {
    console.error('fnEscalate error:', err);
    throw err;
  }
};

/**
 * esc1: 1분 경과 → teacher 재알림
 */
async function escalateLevel1(evt) {
  const users = await getUsersBySite(evt.siteId, ['teacher']);
  if (users.length === 0) {
    console.log(`esc1: no teachers for site ${evt.siteId}`);
    return;
  }

  await sendFcmToUsers(users, {
    eventId: evt.eventId,
    siteId: evt.siteId,
    severity: evt.severity,
    type: 'ESCALATION',
    title: `[에스컬레이션] ${evt.title}`,
    body: `1분 이상 미확인 위험입니다. 즉시 확인하세요.`,
    occurredAt: evt.occurredAt,
  });

  console.log(`esc1: ${evt.eventId} → ${users.length} teachers`);
}

/**
 * esc2: 3분 경과 → admin 알림
 */
async function escalateLevel2(evt) {
  const users = await getUsersBySite(evt.siteId, ['admin']);
  if (users.length === 0) {
    console.log(`esc2: no admins for site ${evt.siteId}`);
    return;
  }

  await sendFcmToUsers(users, {
    eventId: evt.eventId,
    siteId: evt.siteId,
    severity: evt.severity,
    type: 'ESCALATION',
    title: `[긴급 에스컬레이션] ${evt.title}`,
    body: `3분 이상 미확인 위험입니다. 관리자 확인이 필요합니다.`,
    occurredAt: evt.occurredAt,
  });

  console.log(`esc2: ${evt.eventId} → ${users.length} admins`);

  // 3분 미확인 → 관리자 이메일 병행 통보
  await sendAlertEmail({
    severity: evt.severity, prefix: '[긴급 에스컬레이션] ',
    title: evt.title, body: '3분 이상 미확인 위험입니다. 관리자 확인이 필요합니다.',
    siteId: evt.siteId, eventId: evt.eventId, occurredAt: evt.occurredAt,
  });
}

/**
 * esc3: 5분 경과 → 전 관리자·책임자 알림
 */
async function escalateLevel3(evt) {
  // 전 관리자·책임자 = admin + teacher (모든 관리 역할)
  const users = await getUsersBySite(evt.siteId, ['admin', 'teacher']);
  if (users.length === 0) {
    console.log(`esc3: no admin/teacher for site ${evt.siteId}`);
    return;
  }

  await sendFcmToUsers(users, {
    eventId: evt.eventId,
    siteId: evt.siteId,
    severity: evt.severity,
    type: 'ESCALATION',
    title: `[최종 에스컬레이션] ${evt.title}`,
    body: `5분 이상 미확인 위험! 모든 관리자에게 통보되었습니다.`,
    occurredAt: evt.occurredAt,
  });

  console.log(`esc3: ${evt.eventId} → ${users.length} admin+teachers`);

  // 5분 미확인 최종 → 이메일 병행 통보
  await sendAlertEmail({
    severity: evt.severity, prefix: '[최종 에스컬레이션] ',
    title: evt.title, body: '5분 이상 미확인 위험! 모든 관리자에게 통보되었습니다.',
    siteId: evt.siteId, eventId: evt.eventId, occurredAt: evt.occurredAt,
  });
}
