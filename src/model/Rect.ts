import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Rect extends Shape {
  public override readonly typeName = 'rect';

  private x: number;
  private y: number;
  private width: number;
  private height: number;

  public constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public scaleBy(factor: number): void {
    this.x *= factor;
    this.y *= factor;
    this.width *= factor;
    this.height *= factor;
  }

  public summary(): string {
    return `x=${formatNumber(this.x)} y=${formatNumber(this.y)} w=${formatNumber(this.width)} h=${formatNumber(this.height)}`;
  }

  public override positionAnchor(): readonly [number, number] {
    return [this.x, this.y];
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      x: formatNumber(this.x),
      y: formatNumber(this.y),
      width: formatNumber(this.width),
      height: formatNumber(this.height),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'x') return formatNumber(this.x);
    if (name === 'y') return formatNumber(this.y);
    if (name === 'width') return formatNumber(this.width);
    if (name === 'height') return formatNumber(this.height);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'x') {
      this.x = parseNumber(value);
      return true;
    }
    if (name === 'y') {
      this.y = parseNumber(value);
      return true;
    }
    if (name === 'width') {
      this.width = parseNumber(value);
      return true;
    }
    if (name === 'height') {
      this.height = parseNumber(value);
      return true;
    }
    return false;
  }
}
