#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SafegaiStack } from '../lib/safegai-stack';

const app = new cdk.App();

new SafegaiStack(app, 'SafegaiStack', {
  env: {
    account: '050649355977',
    region: 'ap-northeast-2',
  },
  description: 'SafeGAI 스마트안전 시스템 백엔드 (IoT + Lambda + DynamoDB + API)',
});
