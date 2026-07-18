/**
 * InAppBanner — 포그라운드 알림 인앱 배너 3초 표시 (§7)
 * 탭 시 해당 eventId의 M4 상세로 이동.
 * 애니메이션 점멸·진동 금지 (push-policy 톤).
 */
import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { pushStore } from '../stores/pushStore';
import { colors, typography, spacing, radius } from '../theme/tokens';

const SEVERITY_COLORS: Record<string, string> = {
  DANGER: colors.severity.danger,
  WARNING: colors.severity.warning,
  FAULT: colors.severity.fault,
  INFO: colors.severity.info,
};

interface Props {
  onPress?: (eventId: string) => void;
}

export function InAppBanner({ onPress }: Props) {
  const banner = pushStore((s) => s.banner);
  const hideBanner = pushStore((s) => s.hideBanner);

  if (!banner) return null;

  const handlePress = () => {
    hideBanner();
    if (banner.eventId && onPress) {
      onPress(banner.eventId);
    }
  };

  const barColor = SEVERITY_COLORS[banner.severity] ?? colors.severity.info;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityLabel={`알림: ${banner.title}`}
    >
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
        <Text style={styles.body} numberOfLines={1}>{banner.body}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  bar: { width: 4 },
  content: { flex: 1, padding: spacing.md },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text.main,
  },
  body: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    color: colors.text.sub,
    marginTop: 2,
  },
});
