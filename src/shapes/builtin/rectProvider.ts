import { Rect } from '../../model/Rect';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const rectProvider: ShapeProvider = {
  typeName: 'rect',
  params: [
    { name: 'x', numeric: true, optional: false },
    { name: 'y', numeric: true, optional: false },
    { name: 'width', numeric: true, optional: false },
    { name: 'height', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const rect = new Rect(
      id,
      parseNumber(attrs.get('x') ?? '0'),
      parseNumber(attrs.get('y') ?? '0'),
      parseNumber(attrs.get('width') ?? '0'),
      parseNumber(attrs.get('height') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) rect.setAttr(name, value);
    }
    return rect;
  },
};
