import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber } from '../../src/model/format';
import { InvalidArgumentError } from '../../src/model/errors';

describe('formatNumber', () => {
  it('prints integers without a decimal point', () => {
    expect(formatNumber(130)).toBe('130');
    expect(formatNumber(0)).toBe('0');
  });

  it('keeps meaningful decimals', () => {
    expect(formatNumber(130.5)).toBe('130.5');
  });

  it('rounds floating-point noise away', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });
});

describe('parseNumber', () => {
  it('parses integers and decimals', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-1.5')).toBe(-1.5);
  });

  it('throws InvalidArgumentError on non-numeric input', () => {
    expect(() => parseNumber('abc')).toThrow(InvalidArgumentError);
    expect(() => parseNumber('')).toThrow(InvalidArgumentError);
  });
});
