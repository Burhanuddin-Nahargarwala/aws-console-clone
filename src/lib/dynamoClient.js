// DynamoDB API client — talks to Floci via the /s3-api Vite proxy
// No SDK needed: DynamoDB uses a simple JSON-RPC style over HTTP POST

import { getRegion } from './regionStore';

const DATE = () => new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
const auth = (region) => `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/dynamodb/aws4_request, SignedHeaders=host;x-amz-date, Signature=test`;

async function dynamoRequest(action, payload) {
  const region = getRegion();
  const response = await fetch('/s3-api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': `DynamoDB_20120810.${action}`,
      'Authorization': auth(region),
      'X-Amz-Date': DATE(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || `DynamoDB ${action} failed (${response.status})`);
  }
  return data;
}

/* ── Table operations ──────────────────────────────────────────────── */

export async function listTables() {
  const data = await dynamoRequest('ListTables', {});
  return data.TableNames || [];
}

export async function createTable({ tableName, partitionKey, partitionKeyType, sortKey, sortKeyType }) {
  const keySchema = [{ AttributeName: partitionKey, KeyType: 'HASH' }];
  const attributeDefinitions = [{ AttributeName: partitionKey, AttributeType: partitionKeyType }];

  if (sortKey) {
    keySchema.push({ AttributeName: sortKey, KeyType: 'RANGE' });
    attributeDefinitions.push({ AttributeName: sortKey, AttributeType: sortKeyType });
  }

  return dynamoRequest('CreateTable', {
    TableName: tableName,
    KeySchema: keySchema,
    AttributeDefinitions: attributeDefinitions,
    BillingMode: 'PAY_PER_REQUEST',
  });
}

export async function describeTable(tableName) {
  const data = await dynamoRequest('DescribeTable', { TableName: tableName });
  return data.Table;
}

export async function deleteTable(tableName) {
  return dynamoRequest('DeleteTable', { TableName: tableName });
}

/* ── Item operations ───────────────────────────────────────────────── */

export async function scanTable(tableName, limit = 100) {
  return dynamoRequest('Scan', { TableName: tableName, Limit: limit });
}

// Build FilterExpression from array of filter objects
// filter = { attribute, type, condition, value, value2 }
function buildFilterExpression(filters, namePrefix = 'attr', valPrefix = 'val') {
  const names = {};
  const values = {};
  const exprs = [];

  filters.forEach((f, i) => {
    if (!f.attribute.trim()) return;
    const nk = `#${namePrefix}${i}`;
    const vk = `:${valPrefix}${i}`;
    names[nk] = f.attribute.trim();

    if (f.condition === 'attribute_exists') {
      exprs.push(`attribute_exists(${nk})`);
    } else if (f.condition === 'attribute_not_exists') {
      exprs.push(`attribute_not_exists(${nk})`);
    } else if (f.condition === 'begins_with') {
      values[vk] = { S: f.value };
      exprs.push(`begins_with(${nk}, ${vk})`);
    } else if (f.condition === 'contains') {
      values[vk] = { S: f.value };
      exprs.push(`contains(${nk}, ${vk})`);
    } else if (f.condition === 'between') {
      const vk2 = `${vk}b`;
      values[vk]  = f.type === 'N' ? { N: String(f.value) }  : { S: String(f.value) };
      values[vk2] = f.type === 'N' ? { N: String(f.value2) } : { S: String(f.value2) };
      exprs.push(`${nk} BETWEEN ${vk} AND ${vk2}`);
    } else {
      values[vk] = f.type === 'N' ? { N: String(f.value) } : { S: String(f.value) };
      exprs.push(`${nk} ${f.condition} ${vk}`);
    }
  });

  return { expression: exprs.join(' AND '), names, values };
}

export async function scanWithFilters(tableName, filters = [], limit = 100) {
  const payload = { TableName: tableName, Limit: limit };

  const valid = filters.filter(f => f.attribute.trim() &&
    (['attribute_exists', 'attribute_not_exists'].includes(f.condition) || f.value !== ''));

  if (valid.length > 0) {
    const { expression, names, values } = buildFilterExpression(valid);
    payload.FilterExpression = expression;
    payload.ExpressionAttributeNames = names;
    if (Object.keys(values).length > 0) payload.ExpressionAttributeValues = values;
  }

  return dynamoRequest('Scan', payload);
}

export async function queryTable(tableName, { pkName, pkValue, pkType, skName, skType, skCondition, skValue, skValue2, filters = [], limit = 100 }) {
  const names  = { '#pk': pkName };
  const values = { ':pkval': pkType === 'N' ? { N: String(pkValue) } : { S: String(pkValue) } };

  let keyCondExpr = '#pk = :pkval';

  if (skName && skCondition && skValue !== '') {
    names['#sk'] = skName;
    if (skCondition === 'between') {
      values[':skv']  = skType === 'N' ? { N: String(skValue) }  : { S: String(skValue) };
      values[':skv2'] = skType === 'N' ? { N: String(skValue2) } : { S: String(skValue2) };
      keyCondExpr += ' AND #sk BETWEEN :skv AND :skv2';
    } else if (skCondition === 'begins_with') {
      values[':skv'] = { S: String(skValue) };
      keyCondExpr += ' AND begins_with(#sk, :skv)';
    } else {
      values[':skv'] = skType === 'N' ? { N: String(skValue) } : { S: String(skValue) };
      keyCondExpr += ` AND #sk ${skCondition} :skv`;
    }
  }

  const payload = {
    TableName: tableName,
    KeyConditionExpression: keyCondExpr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    Limit: limit,
  };

  const valid = filters.filter(f => f.attribute.trim() &&
    (['attribute_exists', 'attribute_not_exists'].includes(f.condition) || f.value !== ''));

  if (valid.length > 0) {
    const { expression, names: fNames, values: fValues } = buildFilterExpression(valid, 'fattr', 'fval');
    payload.FilterExpression = expression;
    Object.assign(payload.ExpressionAttributeNames, fNames);
    if (Object.keys(fValues).length > 0) {
      payload.ExpressionAttributeValues = { ...payload.ExpressionAttributeValues, ...fValues };
    }
  }

  return dynamoRequest('Query', payload);
}

export async function putItem(tableName, item) {
  return dynamoRequest('PutItem', { TableName: tableName, Item: item });
}

export async function deleteItem(tableName, key) {
  return dynamoRequest('DeleteItem', { TableName: tableName, Key: key });
}

/* ── DynamoDB type converters ──────────────────────────────────────── */

// DynamoDB typed value → plain JS value (for display)
export function fromDynamoValue(val) {
  if (val.S !== undefined) return val.S;
  if (val.N !== undefined) return val.N;
  if (val.BOOL !== undefined) return String(val.BOOL);
  if (val.NULL !== undefined) return 'null';
  if (val.L !== undefined) return JSON.stringify(val.L.map(fromDynamoValue));
  if (val.M !== undefined) return JSON.stringify(
    Object.fromEntries(Object.entries(val.M).map(([k, v]) => [k, fromDynamoValue(v)]))
  );
  return JSON.stringify(val);
}

// DynamoDB item → plain { key: displayValue } object
export function fromDynamoItem(item) {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, fromDynamoValue(v)])
  );
}

// Plain JS value → DynamoDB typed value (for writes)
export function toDynamoValue(val) {
  if (typeof val === 'number' || (typeof val === 'string' && val !== '' && !isNaN(Number(val)))) {
    return { N: String(val) };
  }
  if (typeof val === 'boolean') return { BOOL: val };
  if (val === null || val === 'null') return { NULL: true };
  return { S: String(val) };
}

// Parse a JSON string representing a full DynamoDB item
// Each attribute should be { "attrName": { "S": "value" } } or simplified { "attrName": "value" }
export function parseItemJson(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const item = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && ('S' in v || 'N' in v || 'BOOL' in v || 'NULL' in v || 'L' in v || 'M' in v)) {
      item[k] = v; // already in DynamoDB format
    } else {
      item[k] = toDynamoValue(v); // auto-convert
    }
  }
  return item;
}
