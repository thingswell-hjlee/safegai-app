import { AppRegistry } from 'react-native';
import 'react-native-get-random-values';
import { registerBackgroundHandler } from './src/push/messaging';
import App from './App';

// FCM 백그라운드 메시지 핸들러 (엔트리 최상단에서 등록)
registerBackgroundHandler();

AppRegistry.registerComponent('SafeGAI', () => App);
