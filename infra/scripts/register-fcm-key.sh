#!/bin/bash
# FCM 서비스 계정 키를 Secrets Manager에 등록하는 스크립트
# 사용법: ./register-fcm-key.sh <path-to-firebase-service-account.json>
#
# Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
# 다운로드한 JSON 파일 경로를 인자로 전달

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path-to-firebase-service-account.json>"
  echo ""
  echo "Firebase 콘솔에서 서비스 계정 키 JSON을 다운로드 후 실행하세요."
  echo "https://console.firebase.google.com/ > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성"
  exit 1
fi

KEY_FILE="$1"

if [ ! -f "$KEY_FILE" ]; then
  echo "ERROR: 파일을 찾을 수 없습니다: $KEY_FILE"
  exit 1
fi

# JSON 유효성 검증
if ! python3 -c "import json; json.load(open('$KEY_FILE'))" 2>/dev/null; then
  echo "ERROR: 유효한 JSON 파일이 아닙니다."
  exit 1
fi

echo "FCM 서비스 계정 키를 Secrets Manager에 등록합니다..."
echo "Secret: safegai/fcm-service-account-key"
echo "Region: ap-northeast-2"

aws secretsmanager put-secret-value \
  --region ap-northeast-2 \
  --secret-id "safegai/fcm-service-account-key" \
  --secret-string "file://$KEY_FILE"

echo ""
echo "✅ FCM 키가 성공적으로 등록되었습니다."
echo "   Lambda 재배포 없이 즉시 반영됩니다 (런타임에 Secrets Manager에서 로드)."
