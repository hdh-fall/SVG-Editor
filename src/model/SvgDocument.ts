import { Container } from './Container';
import type { Shape } from './Shape';
import type { SvgNode } from './SvgNode';
import {
  DuplicateIdError,
  NoSuchContainerError,
  NoSuchShapeError,
  NotAContainerError,
} from './errors';
import { formatNumber } from './format';

export const ROOT_ID = 'svg';

/** Where a node sits inside the tree — enough to detach and later re-attach it. */
export interface NodeLocation {
  readonly parent: Container;
  readonly index: number;
}

/**
 * The document root: canvas size plus the whole shape tree.
 *
 * It is the single owner of structural mutation, so the id index can be rebuilt
 * after every change instead of being patched incrementally.
 */
export class SvgDocument extends Container {
  public override readonly typeName = 'svg';

  private canvasWidth: number;
  private canvasHeight: number;
  private readonly index = new Map<string, Shape>();

  public constructor(width: number, height: number) {
    super(ROOT_ID);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.rebuildIndex();
  }

  public get width(): number {
    return this.canvasWidth;
  }

  public get height(): number {
    return this.canvasHeight;
  }

  public resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /** Number of shapes in the tree, excluding the root (the spec's "(N elements)"). */
  public count(): number {
    return this.index.size - 1;
  }

  public find(id: string): Shape | null {
    return this.index.get(id) ?? null;
  }

  public requireShape(id: string): Shape {
    const shape = this.find(id);
    if (shape === null) {
      throw new NoSuchShapeError(id);
    }
    return shape;
  }

  public requireContainer(id: string): Container {
    const shape = this.find(id);
    if (shape === null) {
      throw new NoSuchContainerError(id);
    }
    const container = shape.asContainer();
    if (container === null) {
      throw new NotAContainerError(id);
    }
    return container;
  }

  public assertIdFree(id: string): void {
    if (this.index.has(id)) {
      throw new DuplicateIdError(id);
    }
  }

  public isTopLevel(shape: Shape): boolean {
    return shape.parent === this;
  }

  public locationOf(shape: Shape): NodeLocation {
    const parent = shape.parent;
    if (parent === null) {
      throw new Error('the document root has no location');
    }
    return { parent, index: parent.indexOf(shape) };
  }

  /** Remove a node from wherever it is; the returned location can replay the move. */
  public detach(shape: Shape): NodeLocation {
    const location = this.locationOf(shape);
    location.parent.removeAt(location.index);
    this.rebuildIndex();
    return location;
  }

  public attach(shape: Shape, location: NodeLocation): void {
    const index = Math.min(location.index, location.parent.children.length);
    location.parent.insert(shape, index);
    this.rebuildIndex();
  }

  public rebuildIndex(): void {
    this.index.clear();
    this.index.set(this.id, this);
    this.indexSubtree(this);
  }

  public override toXml(): SvgNode {
    return {
      tag: 'svg',
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: formatNumber(this.canvasWidth),
        height: formatNumber(this.canvasHeight),
        viewBox: `0 0 ${formatNumber(this.canvasWidth)} ${formatNumber(this.canvasHeight)}`,
      },
      children: this.children.map((child) => child.toXml()),
    };
  }

  private indexSubtree(container: Container): void {
    for (const child of container.children) {
      this.index.set(child.id, child);
      const nested = child.asContainer();
      if (nested !== null) {
        this.indexSubtree(nested);
      }
    }
  }
}
