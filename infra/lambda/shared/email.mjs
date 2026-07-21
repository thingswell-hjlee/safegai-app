/**
 * shared/email.mjs — 위험 알람 이메일 발송 (AWS SES)
 *
 * env: ALERT_EMAIL_FROM(SES 검증 주소), ALERT_EMAIL_TO(쉼표 구분 복수 가능)
 * 발송 실패는 로그만 남기고 삼킨다 — 이메일 장애가 푸시·저장을 막으면 안 됨.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({ region: 'ap-northeast-2' });

const SEVERITY_LABEL = { DANGER: '🚨 위험', WARNING: '⚠️ 주의', FAULT: '🔧 장애', INFO: 'ℹ️ 정보' };

/**
 * 알람 이메일 발송
 * @param {{severity:string, title:string, body?:string, siteId?:string, eventId?:string, occurredAt?:string, prefix?:string}} p
 */
export async function sendAlertEmail(p) {
  const from = process.env.ALERT_EMAIL_FROM;
  const toRaw = process.env.ALERT_EMAIL_TO;
  if (!from || !toRaw) return { sent: false, reason: 'env 미설정' };

  const to = toRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const label = SEVERITY_LABEL[p.severity] || p.severity;
  const subject = `[SafeGAI] ${p.prefix || ''}${label} — ${p.title}`;
  const when = p.occurredAt ? new Date(p.occurredAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';

  const text = [
    `${label} 알람이 발생했습니다.`,
    '',
    `제목: ${p.title}`,
    p.body ? `내용: ${p.body}` : null,
    when ? `발생 시각: ${when}` : null,
    p.siteId ? `현장: ${p.siteId}` : null,
    p.eventId ? `이벤트: ${p.eventId}` : null,
    '',
    'SafeGAI 앱에서 확인 후 조치해 주세요.',
  ].filter((l) => l !== null).join('\n');

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: to },
      Content: { Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      } },
    }));
    return { sent: true };
  } catch (err) {
    console.error('알람 이메일 발송 실패:', err.message);
    return { sent: false, reason: err.message };
  }
}
