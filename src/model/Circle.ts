import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Circle extends Shape {
  public override readonly typeName = 'circle';

  private cx: number;
  private cy: number;
  private r: number;

  public constructor(id: string, cx: number, cy: number, r: number) {
    super(id);
    this.cx = cx;
    this.cy = cy;
    this.r = r;
  }

  public translate(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  public scaleBy(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.r *= factor;
  }

  public summary(): string {
    return `cx=${formatNumber(this.cx)} cy=${formatNumber(this.cy)} r=${formatNumber(this.r)}`;
  }

  public override positionAnchor(): readonly [number, number] {
    return [this.cx, this.cy];
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      cx: formatNumber(this.cx),
      cy: formatNumber(this.cy),
      r: formatNumber(this.r),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'cx') return formatNumber(this.cx);
    if (name === 'cy') return formatNumber(this.cy);
    if (name === 'r') return formatNumber(this.r);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'cx') {
      this.cx = parseNumber(value);
      return true;
    }
    if (name === 'cy') {
      this.cy = parseNumber(value);
      return true;
    }
    if (name === 'r') {
      this.r = parseNumber(value);
      return true;
    }
    return false;
  }
}
