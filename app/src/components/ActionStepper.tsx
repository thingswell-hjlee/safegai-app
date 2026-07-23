/**
 * ActionStepper — 조치 3단계 하단 고정 (§3)
 * 확인했어요(OPEN→ACKED) → 조치 중(ACKED→IN_PROGRESS) → 완료(IN_PROGRESS→RESOLVED)
 * API 성공 후 반영, 실패 롤백+토스트. 연타 방지(응답까지 비활성).
 * 권한 기반: ack=teacher↑, assign=admin(본인지정 teacher↑), resolve=assignee·admin
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';
import { UserRole } from '../utils/auth';

type Status = 'OPEN' | 'ACKED' | 'IN_PROGRESS' | 'RESOLVED';

interface Step {
  label: string;        // 진행 표시용 (상태 이름)
  buttonLabel: string;  // 버튼용 (행동형 문구 — 시니어 배려)
  fromStatus: Status;
  toStatus: Status;
}

const STEPS: Step[] = [
  { label: '확인', buttonLabel: '✓ 확인했어요', fromStatus: 'OPEN', toStatus: 'ACKED' },
  { label: '조치 중', buttonLabel: '▶ 조치를 시작할게요', fromStatus: 'ACKED', toStatus: 'IN_PROGRESS' },
  { label: '완료', buttonLabel: '✓ 조치를 끝냈어요', fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED' },
];

interface Props {
  currentStatus: Status;
  role: UserRole | null;
  userId: string | null;
  assigneeUserId?: string | null;
  isLoading: boolean;
  onAction: (toStatus: Status) => void;
}

function canPerformAction(
  step: Step,
  role: UserRole | null,
  userId: string | null,
  assigneeUserId?: string | null,
): boolean {
  if (!role) return false;
  const roleLevel = { admin: 4, teacher: 3, operator: 2, maintainer: 1 }[role] ?? 0;

  switch (step.toStatus) {
    case 'ACKED':
      // ack: teacher↑
      return roleLevel >= 3;
    case 'IN_PROGRESS':
      // assign: admin(본인지정 teacher↑)
      return roleLevel >= 3; // teacher↑ (본인 지정)
    case 'RESOLVED':
      // resolve: assignee 또는 admin
      return roleLevel >= 4 || userId === assigneeUserId;
    default:
      return false;
  }
}

export function ActionStepper({ currentStatus, role, userId, assigneeUserId, isLoading, onAction }: Props) {
  if (currentStatus === 'RESOLVED') {
    return (
      <View style={styles.container}>
        <View style={styles.completedBar}>
          <Text style={styles.completedText}>✅ 조치가 모두 끝났습니다</Text>
        </View>
      </View>
    );
  }

  const currentStep = STEPS.find((s) => s.fromStatus === currentStatus);
  if (!currentStep) return null;

  const hasPermission = canPerformAction(currentStep, role, userId, assigneeUserId);
  if (!hasPermission) return null;

  const stepIndex = STEPS.indexOf(currentStep);

  return (
    <View style={styles.container}>
      {/* 진행 표시 */}
      <View style={styles.progress}>
        {STEPS.map((step, i) => (
          <View key={step.toStatus} style={styles.stepDot}>
            <View style={[
              styles.dot,
              i <= stepIndex ? styles.dotActive : styles.dotInactive,
            ]} />
            <Text style={[
              styles.stepLabel,
              i === stepIndex && styles.stepLabelActive,
            ]}>{step.label}</Text>
          </View>
        ))}
      </View>

      {/* 액션 버튼 */}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => onAction(currentStep.toStatus)}
        disabled={isLoading}
        activeOpacity={0.8}
        accessibilityLabel={currentStep.buttonLabel}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.buttonText}>{currentStep.buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepDot: { alignItems: 'center', flex: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, marginBottom: spacing.xs },
  dotActive: { backgroundColor: colors.brand.navy },
  dotInactive: { backgroundColor: colors.line },
  stepLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    color: colors.text.sub,
  },
  stepLabelActive: { color: colors.brand.navy, fontWeight: '700' },
  button: {
    backgroundColor: colors.brand.navy,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text.inverse,
  },
  completedBar: {
    backgroundColor: colors.state.ok,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  completedText: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});
