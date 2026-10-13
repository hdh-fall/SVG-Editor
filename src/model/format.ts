import { InvalidArgumentError } from './errors';

const ROUNDING = 1e6;

/** Canonical text for a coordinate/size: no trailing `.0`, no floating-point noise. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`not a finite number: ${value}`);
  }
  return String(Math.round(value * ROUNDING) / ROUNDING);
}

/** Parse a user-supplied numeric token, rejecting anything non-finite. */
export function parseNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new InvalidArgumentError('expected a number, got an empty value');
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new InvalidArgumentError(`expected a number, got '${raw}'`);
  }
  return value;
}
