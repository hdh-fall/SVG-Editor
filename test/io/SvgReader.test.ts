import { describe, expect, it } from 'vitest';
import { SvgReader } from '../../src/io/SvgReader';
import { SvgWriter } from '../../src/io/SvgWriter';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import { FileError } from '../../src/model/errors';

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

const reader = new SvgReader(createDefaultShapeFactory());

describe('SvgReader', () => {
  it('reads the canvas size, the tree and the preserved order', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.document.width).toBe(400);
    expect(result.document.height).toBe(300);
    expect(result.document.children.map((s) => s.id)).toEqual(['rect1', 't1', 'c1', 'g1', 'e1']);
    expect(result.document.requireContainer('g1').children.map((s) => s.id)).toEqual(['r2', 'c2']);
    expect(result.document.count()).toBe(7);
  });

  it('assigns an id to an unnamed element and warns', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.warnings).toEqual(['assigned id rect1 to unnamed <rect>']);
    expect(result.document.find('rect1')!.toXml().attrs['fill']).toBe('#ffffff');
  });

  it('keeps the text content of a <text> element', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.document.find('t1')!.getAttr('text')).toBe('imported');
  });

  it('round-trips: read -> write -> read is stable', () => {
    const first = reader.read(OTHER_SVG, 'other.svg').document;
    const text = new SvgWriter().serialize(first.toXml());
    const second = reader.read(text, 'roundtrip.svg').document;
    expect(new SvgWriter().serialize(second.toXml())).toBe(text);
  });

  it('rejects input with no <svg> root', () => {
    expect(() => reader.read('<not-svg/>', 'bad.svg')).toThrow(FileError);
  });
});
