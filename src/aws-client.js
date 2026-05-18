import { S3Client } from '@aws-sdk/client-s3';

const proxyBase = typeof window !== 'undefined'
  ? `${window.location.origin}/s3-api`
  : 'http://localhost:4566';

export const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  endpoint: proxyBase,
  forcePathStyle: true,
  // Disable automatic checksum computation — Floci doesn't require it and some
  // versions of the SDK send checksum headers that confuse the emulator.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
