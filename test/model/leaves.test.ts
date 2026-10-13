import { describe, expect, it } from 'vitest';
import { Circle } from '../../src/model/Circle';
import { Ellipse } from '../../src/model/Ellipse';
import { Line } from '../../src/model/Line';
import { Text } from '../../src/model/Text';
import { UnknownAttributeError } from '../../src/model/errors';

describe('Circle', () => {
  it('translates the centre only and scales the radius', () => {
    const c = new Circle('c1', 100, 100, 20);
    c.translate(30, 0);
    c.scaleBy(2);
    expect(c.summary()).toBe('cx=260 cy=200 r=40');
  });

  it('serializes cx/cy/r', () => {
    expect(new Circle('c1', 50, 50, 10).toXml().attrs).toEqual({
      id: 'c1',
      cx: '50',
      cy: '50',
      r: '10',
    });
  });

  it('rejects a foreign attribute', () => {
    expect(() => new Circle('c1', 0, 0, 1).setAttr('x', '1')).toThrow(UnknownAttributeError);
  });
});

describe('Ellipse', () => {
  it('translates the centre and scales both radii', () => {
    const e = new Ellipse('e1', 1, 2, 3, 4);
    e.translate(1, 1);
    e.scaleBy(2);
    expect(e.summary()).toBe('cx=4 cy=6 rx=6 ry=8');
  });
});

describe('Line', () => {
  it('translates both endpoints and scales all four coordinates', () => {
    const l = new Line('l1', 0, 0, 10, 10);
    l.translate(5, 0);
    l.scaleBy(2);
    expect(l.summary()).toBe('(10,0) -> (30,20)');
  });

  it('defaults stroke to undefined but accepts one', () => {
    const l = new Line('l1', 0, 0, 1, 1);
    expect(l.getAttr('stroke')).toBeUndefined();
    l.setAttr('stroke', 'black');
    expect(l.toXml().attrs['stroke']).toBe('black');
  });
});

describe('Text', () => {
  it('translates the anchor and keeps content', () => {
    const t = new Text('t1', 20, 40, 'My Diagram');
    t.translate(5, 5);
    t.scaleBy(2);
    expect(t.summary()).toBe('(50,90) "My Diagram"');
  });

  it('exposes content through the `text` attribute name', () => {
    const t = new Text('t1', 0, 0, 'a');
    t.setAttr('text', 'b');
    expect(t.getAttr('text')).toBe('b');
    expect(t.toXml()).toEqual({ tag: 'text', attrs: { id: 't1', x: '0', y: '0' }, text: 'b' });
  });
});
