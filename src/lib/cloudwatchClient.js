// CloudWatch Logs client — talks to Floci via the /s3-api Vite proxy
// Same pattern as dynamoClient.js: HTTP POST with X-Amz-Target header, no SDK needed.

import { getRegion } from './regionStore';

const DATE = () => new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
const auth = (region) => `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/logs/aws4_request, SignedHeaders=host;x-amz-date, Signature=test`;

async function cwRequest(action, payload) {
  const region = getRegion();
  const response = await fetch('/s3-api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `Logs_20140328.${action}`,
      'Authorization': auth(region),
      'X-Amz-Date': DATE(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || `CloudWatch ${action} failed (${response.status})`);
  }
  return data;
}

export async function describeLogGroups(prefix = '') {
  const payload = { limit: 50 };
  if (prefix) payload.logGroupNamePrefix = prefix;
  const data = await cwRequest('DescribeLogGroups', payload);
  return data.logGroups || [];
}

export async function describeLogStreams(logGroupName) {
  const data = await cwRequest('DescribeLogStreams', {
    logGroupName,
    orderBy: 'LastEventTime',
    descending: true,
    limit: 50,
  });
  return data.logStreams || [];
}

export async function getLogEvents(logGroupName, logStreamName, limit = 200) {
  const data = await cwRequest('GetLogEvents', {
    logGroupName,
    logStreamName,
    limit,
    startFromHead: true,
  });
  return data.events || [];
}
