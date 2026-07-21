/**
 * M9 계정 관리 화면 (admin 전용)
 *
 * - 사용자 목록: 이메일·역할·상태(활성/비활성/초대중)
 * - 계정 추가: 이메일+역할 → Cognito 초대 메일(임시 비밀번호) 자동 발송
 * - 항목 탭 → 관리: 역할 변경 / 활성·비활성 / 비밀번호 재설정
 * 백엔드: /admin/users (fnApi, admin 게이트)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  Alert, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';

interface Props { navigation: any; }

interface ManagedUser {
  username: string;
  email: string;
  roles: string[];
  enabled: boolean;
  status: string;      // CONFIRMED | FORCE_CHANGE_PASSWORD ...
  createdAt: string | null;
}

const ROLES = ['admin', 'teacher', 'operator', 'maintainer'] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: '관리자', teacher: '교사', operator: '운영', maintainer: '유지보수',
};

function primaryRole(roles: string[]): string {
  for (const r of ROLES) if (roles.includes(r)) return r;
  return roles[0] || '-';
}

export function AccountManagementScreen({ navigation }: Props) {
  const myUserId = useAuthStore((s) => s.userId);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 추가 모달
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('teacher');
  const [saving, setSaving] = useState(false);

  // 관리 모달 (선택 사용자)
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data?.data?.users || []);
    } catch {
      Alert.alert('오류', '사용자 목록을 불러오지 못했습니다.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('확인', '올바른 이메일 주소를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/admin/users', { email, role: newRole });
      setAddOpen(false);
      setNewEmail('');
      Alert.alert('완료', `${email} 계정을 만들고 초대 메일(임시 비밀번호)을 보냈습니다.\n첫 로그인 전 관리자가 '비밀번호 재설정'으로 최종 비밀번호를 정해 전달하세요.`);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.msg || '계정 생성에 실패했습니다.';
      Alert.alert('실패', msg);
    }
    setSaving(false);
  }

  async function handleRoleChange(user: ManagedUser, role: string) {
    try {
      await apiClient.patch(`/admin/users/${user.username}`, { role });
      setSelected(null);
      load();
    } catch (err: any) {
      Alert.alert('실패', err?.response?.data?.error?.msg || '역할 변경에 실패했습니다.');
    }
  }

  async function handleToggleEnabled(user: ManagedUser) {
    const next = !user.enabled;
    const doIt = async () => {
      try {
        await apiClient.patch(`/admin/users/${user.username}`, { enabled: next });
        setSelected(null);
        load();
      } catch (err: any) {
        Alert.alert('실패', err?.response?.data?.error?.msg || '변경에 실패했습니다.');
      }
    };
    if (!next) {
      Alert.alert('비활성화', `${user.email} 계정을 비활성화할까요?\n해당 사용자는 로그인할 수 없게 됩니다.`, [
        { text: '취소', style: 'cancel' },
        { text: '비활성화', style: 'destructive', onPress: doIt },
      ]);
    } else { doIt(); }
  }

  async function handleResetPw() {
    if (!selected) return;
    if (newPw.length < 8) {
      Alert.alert('확인', '비밀번호는 대문자·소문자·숫자 포함 8자 이상이어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/admin/users/${selected.username}/password`, { password: newPw });
      setPwOpen(false); setSelected(null); setNewPw('');
      Alert.alert('완료', '비밀번호가 변경되었습니다. 당사자에게 안전하게 전달하세요.');
      load();
    } catch (err: any) {
      Alert.alert('실패', err?.response?.data?.error?.msg || '비밀번호 변경에 실패했습니다.');
    }
    setSaving(false);
  }

  function statusLabel(u: ManagedUser) {
    if (!u.enabled) return { text: '비활성', color: colors.severity.fault };
    if (u.status === 'FORCE_CHANGE_PASSWORD') return { text: '초대중', color: colors.severity.warning };
    return { text: '활성', color: colors.state.ok };
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>계정 관리</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brand.navy} size="large" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.username}
          contentContainerStyle={{ padding: spacing.base }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const st = statusLabel(item);
            const isMe = item.username === myUserId;
            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.email}>{item.email}{isMe ? '  (나)' : ''}</Text>
                  <Text style={styles.sub}>{ROLE_LABEL[primaryRole(item.roles)] || primaryRole(item.roles)}</Text>
                </View>
                <Text style={[styles.status, { color: st.color }]}>{st.text}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.sub}>등록된 사용자가 없습니다.</Text>}
        />
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+ 계정 추가</Text>
      </TouchableOpacity>

      {/* ─── 추가 모달 ─── */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>계정 추가</Text>
            <TextInput
              style={styles.input}
              placeholder="이메일 주소"
              placeholderTextColor={colors.text.sub}
              autoCapitalize="none" keyboardType="email-address"
              value={newEmail} onChangeText={setNewEmail}
            />
            <Text style={styles.fieldLabel}>역할</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity key={r}
                  style={[styles.roleChip, newRole === r && styles.roleChipOn]}
                  onPress={() => setNewRole(r)}>
                  <Text style={[styles.roleChipText, newRole === r && styles.roleChipTextOn]}>{ROLE_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>초대 메일(임시 비밀번호)이 해당 주소로 발송됩니다.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setAddOpen(false)}>
                <Text style={styles.btnGhostText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnMain, saving && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving}>
                <Text style={styles.btnMainText}>{saving ? '생성 중...' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 관리 모달 ─── */}
      <Modal visible={!!selected && !pwOpen} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selected?.email}</Text>
            <Text style={styles.fieldLabel}>역할 변경</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => {
                const on = selected ? primaryRole(selected.roles) === r : false;
                return (
                  <TouchableOpacity key={r}
                    style={[styles.roleChip, on && styles.roleChipOn]}
                    onPress={() => selected && handleRoleChange(selected, r)}>
                    <Text style={[styles.roleChipText, on && styles.roleChipTextOn]}>{ROLE_LABEL[r]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.actionRow} onPress={() => setPwOpen(true)}>
              <Text style={styles.actionText}>🔑 비밀번호 재설정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => selected && handleToggleEnabled(selected)}>
              <Text style={[styles.actionText, { color: selected?.enabled ? colors.severity.danger : colors.state.ok }]}>
                {selected?.enabled ? '⛔ 계정 비활성화' : '✅ 계정 활성화'}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setSelected(null)}>
                <Text style={styles.btnGhostText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 비밀번호 재설정 모달 ─── */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>비밀번호 재설정</Text>
            <Text style={styles.sub}>{selected?.email}</Text>
            <TextInput
              style={styles.input}
              placeholder="새 비밀번호 (대·소문자+숫자 8자 이상)"
              placeholderTextColor={colors.text.sub}
              autoCapitalize="none" secureTextEntry
              value={newPw} onChangeText={setNewPw}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => { setPwOpen(false); setNewPw(''); }}>
                <Text style={styles.btnGhostText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnMain, saving && { opacity: 0.5 }]} onPress={handleResetPw} disabled={saving}>
                <Text style={styles.btnMainText}>{saving ? '변경 중...' : '변경'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.app },
  header: {
    backgroundColor: colors.brand.navy, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 56, paddingBottom: spacing.base, paddingHorizontal: spacing.base,
  },
  backBtn: { minWidth: 48, minHeight: touchTarget.min, justifyContent: 'center' },
  backText: { ...typography.body, color: colors.text.inverse },
  headerTitle: { ...typography.title, color: colors.text.inverse },
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.card, padding: spacing.base,
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md,
  },
  email: { ...typography.body, fontWeight: '700', color: colors.text.main },
  sub: { ...typography.caption, color: colors.text.sub, marginTop: 2 },
  status: { ...typography.badge },
  addBtn: {
    backgroundColor: colors.brand.navy, borderRadius: radius.button, minHeight: touchTarget.min,
    justifyContent: 'center', alignItems: 'center', margin: spacing.base,
  },
  addBtnText: { ...typography.title, color: colors.text.inverse },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  modal: { backgroundColor: colors.bg.card, borderRadius: radius.card, padding: spacing.lg },
  modalTitle: { ...typography.title, color: colors.text.main, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.button,
    paddingHorizontal: spacing.md, minHeight: touchTarget.min, marginTop: spacing.sm,
    ...typography.body, color: colors.text.main, backgroundColor: colors.bg.app,
  },
  fieldLabel: { ...typography.caption, color: colors.text.sub, marginTop: spacing.base },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: touchTarget.gap, marginTop: spacing.sm },
  roleChip: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 999,
    paddingHorizontal: spacing.base, minHeight: 40, justifyContent: 'center',
  },
  roleChipOn: { backgroundColor: colors.brand.navy, borderColor: colors.brand.navy },
  roleChipText: { ...typography.body, color: colors.text.main },
  roleChipTextOn: { color: colors.text.inverse, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.text.sub, marginTop: spacing.md },
  actionRow: { minHeight: touchTarget.min, justifyContent: 'center', marginTop: spacing.sm },
  actionText: { ...typography.body, fontWeight: '700', color: colors.text.main },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  btnGhost: { minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.base },
  btnGhostText: { ...typography.body, color: colors.text.sub },
  btnMain: {
    backgroundColor: colors.brand.navy, borderRadius: radius.button, minHeight: touchTarget.min,
    justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  btnMainText: { ...typography.body, color: colors.text.inverse, fontWeight: '700' },
});
