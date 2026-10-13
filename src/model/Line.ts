import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Line extends Shape {
  public override readonly typeName = 'line';

  private x1: number;
  private y1: number;
  private x2: number;
  private y2: number;

  public constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  public translate(dx: number, dy: number): void {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  public scaleBy(factor: number): void {
    this.x1 *= factor;
    this.y1 *= factor;
    this.x2 *= factor;
    this.y2 *= factor;
  }

  public summary(): string {
    return `(${formatNumber(this.x1)},${formatNumber(this.y1)}) -> (${formatNumber(this.x2)},${formatNumber(this.y2)})`;
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      x1: formatNumber(this.x1),
      y1: formatNumber(this.y1),
      x2: formatNumber(this.x2),
      y2: formatNumber(this.y2),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'x1') return formatNumber(this.x1);
    if (name === 'y1') return formatNumber(this.y1);
    if (name === 'x2') return formatNumber(this.x2);
    if (name === 'y2') return formatNumber(this.y2);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'x1') {
      this.x1 = parseNumber(value);
      return true;
    }
    if (name === 'y1') {
      this.y1 = parseNumber(value);
      return true;
    }
    if (name === 'x2') {
      this.x2 = parseNumber(value);
      return true;
    }
    if (name === 'y2') {
      this.y2 = parseNumber(value);
      return true;
    }
    return false;
  }
}
