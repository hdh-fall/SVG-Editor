import { Container } from './Container';

export class Group extends Container {
  public override readonly typeName = 'g';

  public constructor(id: string) {
    super(id);
  }
}
