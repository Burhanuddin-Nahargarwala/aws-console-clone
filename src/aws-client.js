import { S3Client } from '@aws-sdk/client-s3';
import { getRegion } from './lib/regionStore';

const proxyBase = typeof window !== 'undefined'
  ? `${window.location.origin}/s3-api`
  : 'http://localhost:4566';

// S3Client is created fresh per-call so it always picks up the current region.
export function getS3Client(region) {
  return new S3Client({
    region: region || getRegion(),
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    endpoint: proxyBase,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

// Backwards-compatible default export for code that imports s3Client directly.
// Uses the region at module load time — good enough for S3 which is global.
export const s3Client = getS3Client();
