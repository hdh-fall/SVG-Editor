import { describe, expect, it } from 'vitest';
import { Rect } from '../../src/model/Rect';
import { UnknownAttributeError } from '../../src/model/errors';

describe('Rect', () => {
  it('translates by mutating x and y only', () => {
    const r = new Rect('r1', 10, 20, 100, 50);
    r.translate(30, -5);
    expect(r.getAttr('x')).toBe('40');
    expect(r.getAttr('y')).toBe('15');
    expect(r.getAttr('width')).toBe('100');
  });

  it('scales position and size together', () => {
    const r = new Rect('r1', 10, 20, 100, 50);
    r.scaleBy(2);
    expect(r.getAttr('x')).toBe('20');
    expect(r.getAttr('width')).toBe('200');
    expect(r.getAttr('height')).toBe('100');
  });

  it('sets geometry, fill and stroke-width', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    r.setAttr('width', '250');
    r.setAttr('fill', '#eee');
    r.setAttr('stroke-width', '3');
    expect(r.getAttr('width')).toBe('250');
    expect(r.toXml().attrs).toEqual({
      id: 'r1',
      x: '0',
      y: '0',
      width: '250',
      height: '1',
      fill: '#eee',
      'stroke-width': '3',
    });
  });

  it('rejects an attribute outside the whitelist', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    expect(() => r.setAttr('cx', '5')).toThrow(UnknownAttributeError);
  });

  it('reads back an old value with getAttr', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    expect(r.getAttr('x')).toBe('0');
    expect(r.getAttr('fill')).toBeUndefined();
    expect(r.getAttr('nope')).toBeUndefined();
  });

  it('summarizes using the abbreviated w/h labels', () => {
    expect(new Rect('r1', 0, 0, 800, 600).summary()).toBe('x=0 y=0 w=800 h=600');
  });
});
