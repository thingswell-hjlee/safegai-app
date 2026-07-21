/**
 * RootNavigator — 인증 상태 기반 분기 + M1/M3/M4/M5/M8 + 딥링크 + 인앱배너
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigateTo } from './navigationRef';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { pushStore } from '../stores/pushStore';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EventListScreen } from '../screens/EventListScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { ActionProcessScreen } from '../screens/ActionProcessScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AccountManagementScreen } from '../screens/AccountManagementScreen';
import { InAppBanner } from '../components/InAppBanner';
import {
  subscribeForegroundMessages,
  subscribeNotificationOpened,
  getInitialDeepLink,
} from '../push/messaging';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const queryClient = useQueryClient();

  // 딥링크 + 포그라운드 메시지 리스너
  useEffect(() => {
    if (!isAuthenticated) return;

    // 포그라운드 메시지
    const unsubMsg = subscribeForegroundMessages(queryClient);

    // 백그라운드 알림 탭 → M4 이동
    const unsubOpened = subscribeNotificationOpened((eventId) => {
      navigateTo('EventDetail', { eventId });
    });

    // 종료 상태에서 알림 탭으로 앱 열림
    getInitialDeepLink().then((eventId) => {
      if (eventId) {
        // 약간의 지연으로 네비게이션 준비 대기
        setTimeout(() => {
          navigateTo('EventDetail', { eventId });
        }, 500);
      }
    });

    // pending 딥링크 처리 (미로그인→로그인 후)
    const pendingId = pushStore.getState().consumePendingDeepLink();
    if (pendingId) {
      setTimeout(() => {
        navigateTo('EventDetail', { eventId: pendingId });
      }, 500);
    }

    return () => {
      unsubMsg();
      unsubOpened();
    };
  }, [isAuthenticated, queryClient]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.brand.navy} />
      </View>
    );
  }

  const handleBannerPress = (eventId: string) => {
    navigateTo('EventDetail', { eventId });
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="EventList" component={EventListScreen} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            <Stack.Screen name="ActionProcess" component={ActionProcessScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="AccountManagement" component={AccountManagementScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>

      {/* 인앱 배너 (포그라운드 알림) */}
      {isAuthenticated && <InAppBanner onPress={handleBannerPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg.app,
  },
});
