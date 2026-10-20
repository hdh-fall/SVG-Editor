import { describe, expect, it } from 'vitest';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import { Rect } from '../../src/model/Rect';
import { Group } from '../../src/model/Group';
import { Text } from '../../src/model/Text';
import { UnknownShapeTypeError } from '../../src/model/errors';

const factory = createDefaultShapeFactory();

describe('createDefaultShapeFactory', () => {
  it('knows the six built-in types and nothing else', () => {
    for (const type of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) {
      expect(factory.has(type)).toBe(true);
    }
    expect(factory.has('box')).toBe(false);
  });

  it('builds a rect from its attribute record', () => {
    const rect = factory.providerFor('rect').create(
      'r1',
      new Map([
        ['x', '10'],
        ['y', '20'],
        ['width', '100'],
        ['height', '50'],
        ['fill', '#eee'],
      ]),
    );
    expect(rect).toBeInstanceOf(Rect);
    expect(rect.toXml().attrs).toEqual({
      id: 'r1',
      x: '10',
      y: '20',
      width: '100',
      height: '50',
      fill: '#eee',
    });
  });

  it('builds an empty group', () => {
    const group = factory.providerFor('g').create('g1', new Map()) as Group;
    expect(group).toBeInstanceOf(Group);
    expect(group.children).toHaveLength(0);
  });

  it('keeps text content out of the attribute list', () => {
    const text = factory.providerFor('text').create(
      't1',
      new Map([
        ['x', '20'],
        ['y', '40'],
        ['text', 'My Diagram'],
      ]),
    );
    expect(text).toBeInstanceOf(Text);
    expect(text.toXml()).toEqual({
      tag: 'text',
      attrs: { id: 't1', x: '20', y: '40' },
      text: 'My Diagram',
    });
  });

  it('reports an unregistered type', () => {
    expect(() => factory.providerFor('box')).toThrow(UnknownShapeTypeError);
  });
});
