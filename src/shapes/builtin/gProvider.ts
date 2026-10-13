import { Group } from '../../model/Group';
import type { ShapeProvider } from '../ShapeProvider';

export const gProvider: ShapeProvider = {
  typeName: 'g',
  params: [],
  create(id) {
    return new Group(id);
  },
};
