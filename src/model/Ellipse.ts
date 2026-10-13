import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Ellipse extends Shape {
  public override readonly typeName = 'ellipse';

  private cx: number;
  private cy: number;
  private rx: number;
  private ry: number;

  public constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id);
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
  }

  public translate(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  public scaleBy(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.rx *= factor;
    this.ry *= factor;
  }

  public summary(): string {
    return `cx=${formatNumber(this.cx)} cy=${formatNumber(this.cy)} rx=${formatNumber(this.rx)} ry=${formatNumber(this.ry)}`;
  }

  public override positionAnchor(): readonly [number, number] {
    return [this.cx, this.cy];
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      cx: formatNumber(this.cx),
      cy: formatNumber(this.cy),
      rx: formatNumber(this.rx),
      ry: formatNumber(this.ry),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'cx') return formatNumber(this.cx);
    if (name === 'cy') return formatNumber(this.cy);
    if (name === 'rx') return formatNumber(this.rx);
    if (name === 'ry') return formatNumber(this.ry);
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
    if (name === 'rx') {
      this.rx = parseNumber(value);
      return true;
    }
    if (name === 'ry') {
      this.ry = parseNumber(value);
      return true;
    }
    return false;
  }
}
