import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../src/model/SvgDocument';
import { Group } from '../../src/model/Group';
import { Rect } from '../../src/model/Rect';
import { DuplicateIdError, NoSuchShapeError, NotAContainerError } from '../../src/model/errors';

describe('SvgDocument', () => {
  it('finds shapes at any depth', () => {
    const doc = new SvgDocument(800, 600);
    const group = new Group('g');
    const rect = new Rect('r', 0, 0, 1, 1);
    doc.attach(group, { parent: doc, index: 0 });
    doc.attach(rect, { parent: group, index: 0 });

    expect(doc.find('r')).toBe(rect);
    expect(doc.find('nope')).toBeNull();
  });

  it('reports a duplicate id', () => {
    const doc = new SvgDocument(800, 600);
    doc.attach(new Rect('r', 0, 0, 1, 1), { parent: doc, index: 0 });
    expect(() => doc.assertIdFree('r')).toThrow(DuplicateIdError);
    expect(() => doc.assertIdFree('other')).not.toThrow();
  });

  it('distinguishes a missing container from a non-container', () => {
    const doc = new SvgDocument(800, 600);
    doc.attach(new Rect('r', 0, 0, 1, 1), { parent: doc, index: 0 });
    expect(() => doc.requireContainer('nope')).toThrow(/no such container: nope/);
    expect(() => doc.requireContainer('r')).toThrow(NotAContainerError);
  });

  it('detaches with a location that can be replayed', () => {
    const doc = new SvgDocument(800, 600);
    const a = new Rect('a', 0, 0, 1, 1);
    const b = new Rect('b', 0, 0, 1, 1);
    doc.attach(a, { parent: doc, index: 0 });
    doc.attach(b, { parent: doc, index: 1 });

    const location = doc.detach(a);
    expect(doc.children.map((s) => s.id)).toEqual(['b']);
    expect(doc.find('a')).toBeNull();

    doc.attach(a, location);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b']);
    expect(doc.find('a')).toBe(a);
  });

  it('requires a real shape', () => {
    const doc = new SvgDocument(400, 300);
    expect(() => doc.requireShape('ghost')).toThrow(NoSuchShapeError);
    expect(doc.requireShape('svg')).toBe(doc);
  });

  it('serializes the root with canvas size and viewBox', () => {
    const doc = new SvgDocument(400, 200);
    expect(doc.toXml()).toEqual({
      tag: 'svg',
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '400',
        height: '200',
        viewBox: '0 0 400 200',
      },
      children: [],
    });
  });
});
