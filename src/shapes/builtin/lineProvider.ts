import { Line } from '../../model/Line';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const lineProvider: ShapeProvider = {
  typeName: 'line',
  params: [
    { name: 'x1', numeric: true, optional: false },
    { name: 'y1', numeric: true, optional: false },
    { name: 'x2', numeric: true, optional: false },
    { name: 'y2', numeric: true, optional: false },
    { name: 'stroke', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const line = new Line(
      id,
      parseNumber(attrs.get('x1') ?? '0'),
      parseNumber(attrs.get('y1') ?? '0'),
      parseNumber(attrs.get('x2') ?? '0'),
      parseNumber(attrs.get('y2') ?? '0'),
    );
    const stroke = attrs.get('stroke');
    if (stroke !== undefined) line.setAttr('stroke', stroke);
    return line;
  },
};
