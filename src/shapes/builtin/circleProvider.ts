import { Circle } from '../../model/Circle';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const circleProvider: ShapeProvider = {
  typeName: 'circle',
  params: [
    { name: 'cx', numeric: true, optional: false },
    { name: 'cy', numeric: true, optional: false },
    { name: 'r', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const circle = new Circle(
      id,
      parseNumber(attrs.get('cx') ?? '0'),
      parseNumber(attrs.get('cy') ?? '0'),
      parseNumber(attrs.get('r') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) circle.setAttr(name, value);
    }
    return circle;
  },
};
