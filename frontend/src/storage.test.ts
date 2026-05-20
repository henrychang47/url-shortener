import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredCodes, removeStoredCode, saveStoredCode, syncStoredCodes } from './storage';

beforeEach(() => {
  sessionStorage.clear();
});

describe('link code storage', () => {
  it('stores unique codes in insertion order', () => {
    saveStoredCode('abc123');
    saveStoredCode('abc123');
    saveStoredCode('def456');

    expect(getStoredCodes()).toEqual(['abc123', 'def456']);
  });

  it('removes one stored code', () => {
    saveStoredCode('abc123');
    saveStoredCode('def456');

    removeStoredCode('abc123');

    expect(getStoredCodes()).toEqual(['def456']);
  });

  it('syncs stored codes to returned backend codes', () => {
    saveStoredCode('abc123');
    saveStoredCode('missing');

    syncStoredCodes(new Set(['abc123']));

    expect(getStoredCodes()).toEqual(['abc123']);
  });
});
