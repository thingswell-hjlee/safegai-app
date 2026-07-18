/**
 * M8 설정 화면 — 푸시 영역 (push-policy §5 검증)
 *
 * - 푸시 수신 상태: 알림 권한 여부 + 토큰 등록 여부 + 마지막 수신 시각
 * - 시험 발송 버튼: POST /push/test → 결과 토스트
 * - INFO 알림 끔 토글 (DANGER는 항상 켜짐)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { apiClient } from '../api/client';
import { pushStore } from '../stores/pushStore';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';

interface Props { navigation: any; }

export function SettingsScreen({ navigation }: Props) {
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [tokenRegistered, setTokenRegistered] = useState(false);
  const [infoEnabled, setInfoEnabled] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const lastPushAt = pushStore((s) => s.lastPushAt);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    // 권한 확인
    const status = await messaging().hasPermission();
    setPermGranted(
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL,
    );
    // 토큰 등록 여부
    const token = await AsyncStorage.getItem('fcm_token_value');
    setTokenRegistered(!!token);
    // INFO 토글 상태
    const infoPref = await AsyncStorage.getItem('notify_pref_info');
    setInfoEnabled(infoPref !== 'off');
  }

  async function handleTestPush() {
    setTestLoading(true);
    try {
      const res = await apiClient.post('/push/test');
      if (res.data?.ok) {
        Alert.alert('성공', '테스트 푸시가 발송되었습니다.');
      } else {
        Alert.alert('실패', '테스트 푸시 발송에 실패했습니다.');
      }
    } catch {
      Alert.alert('실패', '테스트 푸시 발송에 실패했습니다.');
    }
    setTestLoading(false);
  }

  async function handleInfoToggle(value: boolean) {
    setInfoEnabled(value);
    await AsyncStorage.setItem('notify_pref_info', value ? 'on' : 'off');
  }

  const lastPushDisplay = lastPushAt
    ? new Date(lastPushAt).toLocaleString('ko-KR')
    : '수신 이력 없음';

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.body}>
        {/* 푸시 수신 상태 */}
        <Text style={styles.sectionTitle}>푸시 알림</Text>

        <View style={styles.row}>
          <Text style={styles.label}>알림 권한</Text>
          <Text style={[styles.value, { color: permGranted ? colors.state.ok : colors.severity.danger }]}>
            {permGranted === null ? '확인 중...' : permGranted ? '허용됨' : '거부됨'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>토큰 등록</Text>
          <Text style={[styles.value, { color: tokenRegistered ? colors.state.ok : colors.severity.fault }]}>
            {tokenRegistered ? '등록됨' : '미등록'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>마지막 수신</Text>
          <Text style={styles.value}>{lastPushDisplay}</Text>
        </View>

        {/* INFO 토글 */}
        <View style={[styles.row, { marginTop: spacing.base }]}>
          <View>
            <Text style={styles.label}>정보(INFO) 알림</Text>
            <Text style={styles.hint}>위험(DANGER)은 항상 켜짐</Text>
          </View>
          <Switch
            value={infoEnabled}
            onValueChange={handleInfoToggle}
            trackColor={{ true: colors.brand.navy, false: colors.line }}
          />
        </View>

        {/* 시험 발송 버튼 */}
        <TouchableOpacity
          style={[styles.testBtn, testLoading && styles.testBtnDisabled]}
          onPress={handleTestPush}
          disabled={testLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.testBtnText}>
            {testLoading ? '발송 중...' : '시험 푸시 발송'}
          </Text>
        </TouchableOpacity>
      </View>
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
  body: { padding: spacing.base },
  sectionTitle: {
    fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight,
    color: colors.text.main, marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  label: { fontSize: typography.body.fontSize, color: colors.text.main },
  value: { fontSize: typography.body.fontSize, fontWeight: '500', color: colors.text.sub },
  hint: { fontSize: typography.caption.fontSize, color: colors.text.sub, marginTop: 2 },
  testBtn: {
    backgroundColor: colors.brand.navy, borderRadius: radius.button,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    minHeight: touchTarget.min,
  },
  testBtnDisabled: { opacity: 0.6 },
  testBtnText: { fontSize: typography.body.fontSize, fontWeight: '700', color: colors.text.inverse },
});
