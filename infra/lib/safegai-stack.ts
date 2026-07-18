import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export class SafegaiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Secrets Manager: FCM 서비스 계정 키 ───────────────────────────
    const fcmSecret = new secretsmanager.Secret(this, 'FcmServiceAccountKey', {
      secretName: 'safegai/fcm-service-account-key',
      description: 'Firebase Cloud Messaging 서비스 계정 키 (콘솔에서 수동 등록)',
    });

    // ─── DynamoDB: events 테이블 ──────────────────────────────────────
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: 'events',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expireAt',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI1: siteId + occurredAt (목록 최신순)
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsiSite', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsiTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: siteId#OPEN + occurredAt (미해결·에스컬레이션)
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsiOpen', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsiTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── DynamoDB: devices 테이블 ─────────────────────────────────────
    const devicesTable = new dynamodb.Table(this, 'DevicesTable', {
      tableName: 'devices',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Cognito UserPool ─────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'SafegaiUserPool', {
      userPoolName: 'safegai-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Cognito 그룹 4개
    const groups = ['admin', 'teacher', 'operator', 'maintainer'];
    for (const groupName of groups) {
      new cognito.CfnUserPoolGroup(this, `Group-${groupName}`, {
        userPoolId: userPool.userPoolId,
        groupName,
        description: `${groupName} 역할 그룹`,
      });
    }

    // UserPool Client (앱용)
    const userPoolClient = new cognito.UserPoolClient(this, 'SafegaiAppClient', {
      userPool,
      userPoolClientName: 'safegai-app',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // ─── Lambda: fnIngest ─────────────────────────────────────────────
    const fnIngest = new lambda.Function(this, 'FnIngest', {
      functionName: 'safegai-fnIngest',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'fnIngest')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EVENTS_TABLE: eventsTable.tableName,
        DEVICES_TABLE: devicesTable.tableName,
        FCM_SECRET_ARN: fcmSecret.secretArn,
      },
    });

    eventsTable.grantReadWriteData(fnIngest);
    devicesTable.grantReadWriteData(fnIngest);
    fcmSecret.grantRead(fnIngest);

    // ─── Lambda: fnEscalate ───────────────────────────────────────────
    const fnEscalate = new lambda.Function(this, 'FnEscalate', {
      functionName: 'safegai-fnEscalate',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'fnEscalate')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EVENTS_TABLE: eventsTable.tableName,
        FCM_SECRET_ARN: fcmSecret.secretArn,
        ESC1_MINUTES: '1',
        ESC2_MINUTES: '3',
        ESC3_MINUTES: '5',
      },
    });

    eventsTable.grantReadWriteData(fnEscalate);
    fcmSecret.grantRead(fnEscalate);

    // ─── Lambda: fnApi ────────────────────────────────────────────────
    const fnApi = new lambda.Function(this, 'FnApi', {
      functionName: 'safegai-fnApi',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'fnApi')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EVENTS_TABLE: eventsTable.tableName,
        DEVICES_TABLE: devicesTable.tableName,
        FCM_SECRET_ARN: fcmSecret.secretArn,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    eventsTable.grantReadWriteData(fnApi);
    devicesTable.grantReadWriteData(fnApi);
    fcmSecret.grantRead(fnApi);

    // ─── IoT Core: Thing gw-01 ───────────────────────────────────────
    const iotThing = new iot.CfnThing(this, 'ThingGw01', {
      thingName: 'gw-01',
    });

    // IoT 정책: 발행 safegai/* 만 허용 (최소 권한)
    const iotPolicy = new iot.CfnPolicy(this, 'GwIotPolicy', {
      policyName: 'safegai-gw-policy',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['iot:Connect'],
            Resource: [`arn:aws:iot:ap-northeast-2:050649355977:client/gw-*`],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Publish'],
            Resource: [`arn:aws:iot:ap-northeast-2:050649355977:topic/safegai/*`],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Subscribe'],
            Resource: [`arn:aws:iot:ap-northeast-2:050649355977:topicfilter/safegai/*/gw/*/cmd/#`],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Receive'],
            Resource: [`arn:aws:iot:ap-northeast-2:050649355977:topic/safegai/*/gw/*/cmd/#`],
          },
        ],
      },
    });

    // IoT Rule: r_events — SELECT * FROM 'safegai/+/gw/+/evt/#' → fnIngest
    const iotRuleRole = new iam.Role(this, 'IotRuleIngestRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });
    fnIngest.grantInvoke(iotRuleRole);

    new iot.CfnTopicRule(this, 'RuleEvents', {
      ruleName: 'r_events',
      topicRulePayload: {
        sql: "SELECT * FROM 'safegai/+/gw/+/evt/#'",
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        actions: [
          {
            lambda: {
              functionArn: fnIngest.functionArn,
            },
          },
        ],
      },
    });

    // IoT가 fnIngest를 호출할 수 있도록 리소스 기반 정책 추가
    fnIngest.addPermission('AllowIotEventsInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:ap-northeast-2:050649355977:rule/r_events`,
    });

    // IoT Rule: r_presence — 생명주기 disconnected → fnIngest
    new iot.CfnTopicRule(this, 'RulePresence', {
      ruleName: 'r_presence',
      topicRulePayload: {
        sql: "SELECT * FROM '$aws/events/presence/disconnected/+'",
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        actions: [
          {
            lambda: {
              functionArn: fnIngest.functionArn,
            },
          },
        ],
      },
    });

    fnIngest.addPermission('AllowIotPresenceInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:ap-northeast-2:050649355977:rule/r_presence`,
    });

    // ─── EventBridge Scheduler: 1분 rate → fnEscalate ─────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerEscalateRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    fnEscalate.grantInvoke(schedulerRole);

    new scheduler.CfnSchedule(this, 'EscalateSchedule', {
      name: 'safegai-escalate-1min',
      scheduleExpression: 'rate(1 minute)',
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: fnEscalate.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });

    // ─── API Gateway: HTTP API + Cognito JWT authorizer → fnApi ───────
    const httpApi = new apigatewayv2.HttpApi(this, 'SafegaiHttpApi', {
      apiName: 'safegai-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.ap-northeast-2.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    );

    const fnApiIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'FnApiIntegration',
      fnApi,
    );

    // 프록시 라우트: 모든 경로를 fnApi가 라우팅 처리
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: fnApiIntegration,
      authorizer: jwtAuthorizer,
    });

    // ─── CloudWatch: Lambda Errors ≥ 1, 5분 경보 → SNS 이메일 ────────
    const alertTopic = new sns.Topic(this, 'SafegaiAlertTopic', {
      topicName: 'safegai-lambda-alerts',
      displayName: 'SafeGAI Lambda 오류 경보',
    });

    // 이메일 구독은 배포 후 콘솔에서 확인 필요 (CDK 파라미터로 주입)
    const alertEmail = new cdk.CfnParameter(this, 'AlertEmail', {
      type: 'String',
      description: 'Lambda 오류 경보 수신 이메일',
      default: 'admin@example.com',
    });

    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(alertEmail.valueAsString),
    );

    // 각 Lambda에 대해 Errors ≥ 1, 5분 경보 생성
    const lambdas = [
      { fn: fnIngest, name: 'fnIngest' },
      { fn: fnEscalate, name: 'fnEscalate' },
      { fn: fnApi, name: 'fnApi' },
    ];

    for (const { fn, name } of lambdas) {
      const alarm = new cloudwatch.Alarm(this, `Alarm-${name}`, {
        alarmName: `safegai-${name}-errors`,
        alarmDescription: `${name} Lambda 오류 발생 (5분 내 1건 이상)`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      alarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    }

    // ─── Outputs ──────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API 엔드포인트 URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito UserPool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: eventsTable.tableName,
    });

    new cdk.CfnOutput(this, 'DevicesTableName', {
      value: devicesTable.tableName,
    });

    new cdk.CfnOutput(this, 'FcmSecretArn', {
      value: fcmSecret.secretArn,
      description: 'FCM 서비스 계정 키 Secret ARN',
    });
  }
}
