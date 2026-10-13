import { describe, expect, it } from 'vitest';
import { Group } from '../../src/model/Group';
import { Rect } from '../../src/model/Rect';
import { Circle } from '../../src/model/Circle';

describe('Group', () => {
  it('recurses translate into every descendant, at any depth', () => {
    const outer = new Group('outer');
    const inner = new Group('inner');
    const rect = new Rect('r', 0, 0, 10, 10);
    outer.insert(inner);
    inner.insert(rect);

    outer.translate(5, 7);

    expect(rect.summary()).toBe('x=5 y=7 w=10 h=10');
  });

  it('recurses scaleBy into every descendant', () => {
    const group = new Group('g');
    const circle = new Circle('c', 10, 10, 5);
    group.insert(circle);

    group.scaleBy(3);

    expect(circle.summary()).toBe('cx=30 cy=30 r=15');
  });

  it('sets parent on insert and clears it on removal', () => {
    const group = new Group('g');
    const rect = new Rect('r', 0, 0, 1, 1);
    group.insert(rect);
    expect(rect.parent).toBe(group);
    expect(group.children).toHaveLength(1);

    group.removeAt(0);
    expect(rect.parent).toBeNull();
    expect(group.children).toHaveLength(0);
  });

  it('inserts at an explicit index', () => {
    const group = new Group('g');
    const a = new Rect('a', 0, 0, 1, 1);
    const b = new Rect('b', 0, 0, 1, 1);
    const c = new Rect('c', 0, 0, 1, 1);
    group.insert(a);
    group.insert(b);
    group.insert(c, 1);
    expect(group.children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('serializes as a nested <g> node', () => {
    const group = new Group('g1');
    group.insert(new Rect('r', 0, 0, 1, 1));
    expect(group.toXml()).toEqual({
      tag: 'g',
      attrs: { id: 'g1' },
      children: [{ tag: 'rect', attrs: { id: 'r', x: '0', y: '0', width: '1', height: '1' } }],
    });
  });

  it('accepts presentation attributes but no geometry', () => {
    const group = new Group('g');
    group.setAttr('fill', 'red');
    expect(group.toXml().attrs).toEqual({ id: 'g', fill: 'red' });
    expect(() => group.setAttr('width', '5')).toThrow();
  });
});
