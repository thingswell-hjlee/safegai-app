/**
 * FreshnessLabel — 'HH:MM 기준' + 60초 초과 시 노랑 '갱신 지연' (§3)
 * 데이터 화면 우상단에 배치.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

interface Props {
  lastUpdatedAt: Date | null;
}

export function FreshnessLabel({ lastUpdatedAt }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!lastUpdatedAt) return null;

  const elapsed = now - lastUpdatedAt.getTime();
  const isStale = elapsed > 60000;
  const timeStr = lastUpdatedAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.container, isStale && styles.staleContainer]}>
      <Text style={[styles.text, isStale && styles.staleText]}>
        {timeStr} 기준{isStale ? ' · 갱신 지연' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  staleContainer: {
    backgroundColor: '#FEF3C7', // 연노랑
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    color: colors.text.sub,
  },
  staleText: {
    color: colors.severity.warning,
  },
});
