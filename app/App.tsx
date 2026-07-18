import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initAmplify } from './src/utils/amplify';
import { useAuthStore } from './src/stores/authStore';
import { setupNotificationChannels, subscribeTokenRefresh } from './src/push';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Amplify 초기화
initAmplify();

export default function App() {
  const tryRestoreSession = useAuthStore((s) => s.tryRestoreSession);

  useEffect(() => {
    tryRestoreSession();
    // 알림 채널 설정 + 토큰 refresh 리스너
    setupNotificationChannels();
    const unsubRefresh = subscribeTokenRefresh();
    return () => { unsubRefresh(); };
  }, [tryRestoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
