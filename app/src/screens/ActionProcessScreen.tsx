/**
 * M5 조치 처리 — ActionStepper로 POST ack → assign → resolve
 * 스테퍼 단계=status 매핑. 연타 방지. 409 안내+최신 재조회.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useEventDetailQuery } from '../api/queries';
import { useAckMutation, useAssignMutation, useResolveMutation } from '../api/mutations';
import { useAuthStore } from '../stores/authStore';
import { useEventStore, SafegaiEvent } from '../stores/eventStore';
import { ActionStepper } from '../components/ActionStepper';
import { SeverityBadge } from '../components/SeverityBadge';
import { LoadingState, ErrorState } from '../components/StateViews';
import { getErrorMessage } from '../api/client';
import { colors, typography, spacing } from '../theme/tokens';

interface Props { route: any; navigation: any; }

export function ActionProcessScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { role, userId } = useAuthStore();
  const { optimisticUpdateStatus, rollbackEvent } = useEventStore();
  const { data: event, isLoading, isError, error, refetch } = useEventDetailQuery(eventId);
  const ackMut = useAckMutation();
  const assignMut = useAssignMutation();
  const resolveMut = useResolveMutation();
  const isMutating = ackMut.isPending || assignMut.isPending || resolveMut.isPending;


  const handleAction = async (toStatus: SafegaiEvent['status']) => {
    if (!event || isMutating) return;
    const prev = optimisticUpdateStatus(eventId, toStatus);
    try {
      switch (toStatus) {
        case 'ACKED':
          await ackMut.mutateAsync(eventId);
          break;
        case 'IN_PROGRESS':
          await assignMut.mutateAsync({ eventId, userId: userId! });
          break;
        case 'RESOLVED':
          await resolveMut.mutateAsync({ eventId });
          break;
      }
    } catch (err: any) {
      if (prev) rollbackEvent(prev);
      if (err?.response?.status !== 409) {
        Alert.alert('오류', '처리에 실패했습니다. 다시 시도해 주세요.');
      }
      refetch();
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError || !event) return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>조치 처리</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <SeverityBadge severity={event.severity} status={event.status} />
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.message}>{event.message}</Text>
      </ScrollView>
      <ActionStepper
        currentStatus={event.status}
        role={role}
        userId={userId}
        assigneeUserId={event.assignee?.userId}
        isLoading={isMutating}
        onAction={handleAction}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.app },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl * 2,
  },
  backBtn: { padding: spacing.xs },
  backText: { fontSize: typography.body.fontSize, color: colors.text.inverse },
  headerTitle: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.inverse },
  body: { flex: 1 },
  bodyContent: { padding: spacing.base, gap: spacing.md },
  title: { fontSize: typography.display.fontSize, fontWeight: typography.display.fontWeight, color: colors.text.main },
  message: { fontSize: typography.body.fontSize, color: colors.text.sub },
});
