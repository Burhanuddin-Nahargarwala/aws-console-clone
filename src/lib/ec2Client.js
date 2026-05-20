import {
  EC2Client,
  DescribeInstancesCommand,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
  DescribeKeyPairsCommand,
  CreateKeyPairCommand,
  DeleteKeyPairCommand,
  DescribeSecurityGroupsCommand,
  CreateSecurityGroupCommand,
  DeleteSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeImagesCommand,
} from '@aws-sdk/client-ec2';
import { getRegion } from './regionStore';

const ENDPOINT = typeof window !== 'undefined'
  ? `${window.location.origin}/s3-api`
  : 'http://localhost:4566';

function getClient() {
  return new EC2Client({
    region: getRegion(),
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    endpoint: ENDPOINT,
  });
}

/* ── Instances ─────────────────────────────────────────────────────── */

export async function describeInstances() {
  const data = await getClient().send(new DescribeInstancesCommand({}));
  const instances = [];
  for (const r of data.Reservations || []) {
    for (const i of r.Instances || []) {
      instances.push(i);
    }
  }
  return instances;
}

export async function runInstance({ imageId, instanceType, keyName, securityGroupIds, name }) {
  const params = {
    ImageId: imageId,
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: keyName || undefined,
    SecurityGroupIds: securityGroupIds?.length ? securityGroupIds : undefined,
    TagSpecifications: name ? [{
      ResourceType: 'instance',
      Tags: [{ Key: 'Name', Value: name }],
    }] : undefined,
  };
  const data = await getClient().send(new RunInstancesCommand(params));
  return data.Instances?.[0];
}

export async function startInstances(instanceIds) {
  return getClient().send(new StartInstancesCommand({ InstanceIds: instanceIds }));
}

export async function stopInstances(instanceIds) {
  return getClient().send(new StopInstancesCommand({ InstanceIds: instanceIds }));
}

export async function terminateInstances(instanceIds) {
  return getClient().send(new TerminateInstancesCommand({ InstanceIds: instanceIds }));
}

/* ── Key Pairs ─────────────────────────────────────────────────────── */

export async function describeKeyPairs() {
  const data = await getClient().send(new DescribeKeyPairsCommand({}));
  return data.KeyPairs || [];
}

export async function createKeyPair(keyName) {
  const data = await getClient().send(new CreateKeyPairCommand({ KeyName: keyName }));
  return data; // contains KeyMaterial (PEM) and KeyPairId
}

export async function deleteKeyPair(keyName) {
  return getClient().send(new DeleteKeyPairCommand({ KeyName: keyName }));
}

/* ── Security Groups ───────────────────────────────────────────────── */

export async function describeSecurityGroups() {
  const data = await getClient().send(new DescribeSecurityGroupsCommand({}));
  return data.SecurityGroups || [];
}

export async function createSecurityGroup({ groupName, description }) {
  const data = await getClient().send(new CreateSecurityGroupCommand({
    GroupName: groupName,
    Description: description,
  }));
  return data.GroupId;
}

export async function deleteSecurityGroup(groupId) {
  return getClient().send(new DeleteSecurityGroupCommand({ GroupId: groupId }));
}

export async function authorizeIngressRule(groupId, { protocol, fromPort, toPort, cidr }) {
  return getClient().send(new AuthorizeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: [{
      IpProtocol: protocol,
      FromPort: fromPort,
      ToPort: toPort,
      IpRanges: [{ CidrIp: cidr }],
    }],
  }));
}

/* ── AMIs ──────────────────────────────────────────────────────────── */

export async function describeImages() {
  try {
    const data = await getClient().send(new DescribeImagesCommand({ Owners: ['amazon'] }));
    return data.Images || [];
  } catch {
    return [];
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

export function getInstanceName(instance) {
  return instance.Tags?.find(t => t.Key === 'Name')?.Value || '—';
}

export const INSTANCE_TYPES = [
  't2.nano', 't2.micro', 't2.small', 't2.medium', 't2.large',
  't3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large',
  'm5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge',
];

export const MOCK_AMIS = [
  { id: 'ami-0abcdef1234567890', name: 'Amazon Linux 2023 AMI', platform: 'Amazon Linux', user: 'ec2-user' },
  { id: 'ami-0abcdef1234567891', name: 'Ubuntu Server 22.04 LTS', platform: 'Ubuntu', user: 'ubuntu' },
  { id: 'ami-0abcdef1234567892', name: 'Ubuntu Server 20.04 LTS', platform: 'Ubuntu', user: 'ubuntu' },
  { id: 'ami-0abcdef1234567893', name: 'Red Hat Enterprise Linux 9', platform: 'RHEL', user: 'ec2-user' },
  { id: 'ami-0abcdef1234567894', name: 'Debian 12 (Bookworm)', platform: 'Debian', user: 'admin' },
];

export const STATE_COLOR = {
  running:      { bg: '#d4edda', color: '#155724', dot: '#28a745' },
  stopped:      { bg: '#f8d7da', color: '#721c24', dot: '#dc3545' },
  pending:      { bg: '#fff3cd', color: '#856404', dot: '#ffc107' },
  stopping:     { bg: '#fff3cd', color: '#856404', dot: '#ffc107' },
  terminated:   { bg: '#e2e3e5', color: '#383d41', dot: '#6c757d' },
  shutting_down:{ bg: '#e2e3e5', color: '#383d41', dot: '#6c757d' },
};
