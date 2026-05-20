import { describe, it, expect } from 'vitest';
import { detectStalePreset } from './index';

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
