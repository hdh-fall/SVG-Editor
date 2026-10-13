import type { Shape } from '../model/Shape';

/** One CLI parameter following `<id>` in a `create` command (spec §4.1). */
export interface ParamSpec {
  /** SVG attribute the token fills (or the pseudo-attribute `text`). */
  readonly name: string;
  readonly numeric: boolean;
  readonly optional: boolean;
}

/**
 * The plugin seam: the kernel never knows a shape type by name — it only consumes
 * providers. A future `box` plugin ships one of these and changes no kernel code.
 */
export interface ShapeProvider {
  readonly typeName: string;
  readonly params: readonly ParamSpec[];
  /** Build the shape from a full attribute record (`create` and the SVG reader both use this). */
  create(id: string, attrs: ReadonlyMap<string, string>): Shape;
}
