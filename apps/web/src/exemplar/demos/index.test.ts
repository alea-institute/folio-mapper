import { describe, it, expect } from 'vitest';
import { detectStalePreset, getDemoPayload, DEMO_AVAILABLE_SLUGS } from './index';

describe('detectStalePreset', () => {
  it('returns null when both versions match', () => {
    expect(
      detectStalePreset({
        payloadPipelineVersion: '0.9.2',
        payloadFolioVersion: '0.2.0',
        runtimePipelineVersion: '0.9.2',
        runtimeFolioVersion: '0.2.0',
      }),
    ).toBeNull();
  });

  it('returns warning when pipeline_version differs', () => {
    const args = {
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: '0.2.0',
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: '0.2.0',
    };
    expect(detectStalePreset(args)).toEqual(args);
  });

  it('returns warning when folio_version differs', () => {
    const args = {
      payloadPipelineVersion: '0.9.2',
      payloadFolioVersion: '0.2.0',
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: '0.2.1',
    };
    expect(detectStalePreset(args)).toEqual(args);
  });

  it('returns null when payload versions are nullish (cannot determine)', () => {
    expect(
      detectStalePreset({
        payloadPipelineVersion: null,
        payloadFolioVersion: null,
        runtimePipelineVersion: '0.9.2',
        runtimeFolioVersion: '0.2.0',
      }),
    ).toBeNull();
  });

  it('returns null when runtime versions are nullish (cannot determine)', () => {
    expect(
      detectStalePreset({
        payloadPipelineVersion: '0.9.2',
        payloadFolioVersion: '0.2.0',
        runtimePipelineVersion: null,
        runtimeFolioVersion: null,
      }),
    ).toBeNull();
  });

  it('fires on pipeline mismatch alone when folio runtime is null', () => {
    const args = {
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: '0.2.0',
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: null,
    };
    expect(detectStalePreset(args)).toEqual(args);
  });
});

describe('demo manifest registration', () => {
  const CANONICAL_SLUGS = [
    'personal-injury',
    'solo-criminal',
    'family-law',
    'employment-labor',
    'corporate-ma',
    'ip-tech',
    'commercial-lit',
    'real-estate',
    'banking-finance',
    'immigration',
  ];

  it('DEMO_AVAILABLE_SLUGS contains all 10 canonical slugs', () => {
    expect(DEMO_AVAILABLE_SLUGS.size).toBe(10);
    for (const slug of CANONICAL_SLUGS) {
      expect(DEMO_AVAILABLE_SLUGS.has(slug)).toBe(true);
    }
  });

  it('getDemoPayload("personal-injury") resolves to a non-null payload with version === "1.3"', async () => {
    const payload = await getDemoPayload('personal-injury');
    expect(payload).not.toBeNull();
    expect(payload?.version).toBe('1.3');
  });

  it('getDemoPayload("does-not-exist") resolves to null', async () => {
    const payload = await getDemoPayload('does-not-exist');
    expect(payload).toBeNull();
  });
});
