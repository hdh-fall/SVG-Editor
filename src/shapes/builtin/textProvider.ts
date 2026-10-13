import { Text } from '../../model/Text';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const textProvider: ShapeProvider = {
  typeName: 'text',
  params: [
    { name: 'x', numeric: true, optional: false },
    { name: 'y', numeric: true, optional: false },
    { name: 'text', numeric: false, optional: false },
  ],
  create(id, attrs) {
    const text = new Text(
      id,
      parseNumber(attrs.get('x') ?? '0'),
      parseNumber(attrs.get('y') ?? '0'),
      attrs.get('text') ?? '',
    );
    const fill = attrs.get('fill');
    if (fill !== undefined) text.setAttr('fill', fill);
    return text;
  },
};
