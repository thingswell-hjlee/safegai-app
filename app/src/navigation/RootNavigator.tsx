/**
 * RootNavigator — 인증 상태 기반 분기 + M1/M3/M4/M5 네비게이션
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EventListScreen } from '../screens/EventListScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { ActionProcessScreen } from '../screens/ActionProcessScreen';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.brand.navy} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="EventList" component={EventListScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen name="ActionProcess" component={ActionProcessScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg.app,
  },
});
