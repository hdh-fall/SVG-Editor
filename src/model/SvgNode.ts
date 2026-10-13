/** Neutral, serializer-agnostic XML node: shapes produce these, the writer renders them. */
export interface SvgNode {
  readonly tag: string;
  readonly attrs: Record<string, string>;
  readonly children?: SvgNode[];
  readonly text?: string;
}
