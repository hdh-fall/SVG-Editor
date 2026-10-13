import { Ellipse } from '../../model/Ellipse';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const ellipseProvider: ShapeProvider = {
  typeName: 'ellipse',
  params: [
    { name: 'cx', numeric: true, optional: false },
    { name: 'cy', numeric: true, optional: false },
    { name: 'rx', numeric: true, optional: false },
    { name: 'ry', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const ellipse = new Ellipse(
      id,
      parseNumber(attrs.get('cx') ?? '0'),
      parseNumber(attrs.get('cy') ?? '0'),
      parseNumber(attrs.get('rx') ?? '0'),
      parseNumber(attrs.get('ry') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) ellipse.setAttr(name, value);
    }
    return ellipse;
  },
};
