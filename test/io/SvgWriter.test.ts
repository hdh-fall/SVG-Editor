import { describe, expect, it } from 'vitest';
import { SvgWriter } from '../../src/io/SvgWriter';
import { SvgDocument } from '../../src/model/SvgDocument';
import { Group } from '../../src/model/Group';
import { Line } from '../../src/model/Line';
import { Rect } from '../../src/model/Rect';
import { Text } from '../../src/model/Text';

const writer = new SvgWriter();

describe('SvgWriter', () => {
  it('writes the XML declaration, 2-space indent and self-closing leaves', () => {
    const doc = new SvgDocument(400, 200);
    const flow = new Group('flow');
    doc.attach(flow, { parent: doc, index: 0 });

    const start = new Rect('start', 30, 70, 120, 60);
    start.setAttr('fill', '#4a90d9');
    flow.insert(start);

    const edge = new Line('edge', 150, 100, 250, 100);
    edge.setAttr('stroke', 'black');
    flow.insert(edge);

    const end = new Rect('end', 250, 70, 120, 60);
    end.setAttr('fill', '#f5a623');
    flow.insert(end);

    expect(writer.serialize(doc.toXml())).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <g id="flow">',
        '    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>',
        '    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>',
        '    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('opens and closes a text element around its content', () => {
    const doc = new SvgDocument(100, 100);
    const text = new Text('t', 5, 5, 'hi');
    doc.attach(text, { parent: doc, index: 0 });
    expect(writer.serialize(doc.toXml())).toContain('  <text id="t" x="5" y="5">hi</text>');
  });

  it('escapes markup in attributes and text', () => {
    const doc = new SvgDocument(10, 10);
    const rect = new Rect('r', 0, 0, 1, 1);
    rect.setAttr('fill', 'a&b');
    doc.attach(rect, { parent: doc, index: 0 });
    const text = new Text('t', 0, 0, 'a<b & "c"');
    doc.attach(text, { parent: doc, index: 1 });

    const output = writer.serialize(doc.toXml());
    expect(output).toContain('fill="a&amp;b"');
    expect(output).toContain('<text id="t" x="0" y="0">a&lt;b &amp; "c"</text>');
  });

  it('renders an empty container as an open/close pair', () => {
    const doc = new SvgDocument(100, 100);
    doc.attach(new Group('scene'), { parent: doc, index: 0 });
    expect(writer.serialize(doc.toXml())).toContain('  <g id="scene">\n  </g>');
  });
});
