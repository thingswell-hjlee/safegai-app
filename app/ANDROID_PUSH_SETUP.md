# Android FCM 푸시 설정 가이드

## 1. google-services.json 배치

Firebase 콘솔에서 Android 앱 등록 후 다운로드한 `google-services.json`을:

```
app/android/app/google-services.json
```

에 배치합니다. **이 파일은 gitignore에 추가하여 커밋하지 않습니다.**

## 2. android/build.gradle

```groovy
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

## 3. android/app/build.gradle

```groovy
apply plugin: 'com.google.gms.google-services'

android {
    defaultConfig {
        applicationId "kr.co.thingswell.safegai"
    }
}
```

## 4. 알림 채널 생성 (MainApplication.java/kt)

Android 8.0+ (API 26)에서 알림 채널을 `onCreate`에서 생성합니다:

```kotlin
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri

override fun onCreate() {
    super.onCreate()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val nm = getSystemService(NotificationManager::class.java)

        // DANGER: importance MAX (무음 불가, 강한 소리)
        val danger = NotificationChannel("danger_channel", "위험 알림", NotificationManager.IMPORTANCE_MAX).apply {
            description = "즉각 대응이 필요한 위험 이벤트"
            enableVibration(true)
        }

        // WARNING: importance DEFAULT
        val warning = NotificationChannel("warning_channel", "주의 알림", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "주의가 필요한 이벤트"
        }

        // FAULT: importance DEFAULT
        val fault = NotificationChannel("fault_channel", "장애 알림", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "시스템 장애 알림"
        }

        // INFO: importance LOW
        val info = NotificationChannel("info_channel", "정보 알림", NotificationManager.IMPORTANCE_LOW).apply {
            description = "일반 정보 알림"
        }

        nm.createNotificationChannels(listOf(danger, warning, fault, info))
    }
}
```

## 5. POST_NOTIFICATIONS 권한 (Android 13+)

`AndroidManifest.xml`에 추가:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

런타임 권한 요청은 앱 코드(push/channels.ts)에서 Firebase Messaging의
`requestPermission()`으로 처리됩니다.

## 6. 패키지명

```
kr.co.thingswell.safegai
```

Firebase 콘솔 Android 앱 등록 시 동일한 패키지명을 사용해야 합니다.
