import { Tokenizer, type Token } from './Tokenizer';

export interface ParsedCommand {
  readonly name: string;
  readonly positional: readonly string[];
  readonly inContainer: string | null;
}

/** Tokens -> `{ name, positional, inContainer }`. Grammar is fixed and tiny (spec §3). */
export class CommandParser {
  private readonly tokenizer = new Tokenizer();

  public parse(line: string): ParsedCommand | null {
    const tokens = this.tokenizer.tokenize(line);
    if (tokens.length === 0) {
      return null;
    }

    const name = tokens[0]!.value;
    const rest = tokens.slice(1);
    const clauseIndex = this.findInClause(rest);

    if (clauseIndex === -1) {
      return { name, positional: rest.map((t) => t.value), inContainer: null };
    }

    return {
      name,
      positional: rest.slice(0, clauseIndex).map((t) => t.value),
      inContainer: rest[clauseIndex + 1]!.value,
    };
  }

  /** Index of the `in` keyword when it forms a trailing `in <id>` pair, else -1. */
  private findInClause(tokens: readonly Token[]): number {
    const index = tokens.length - 2;
    if (index < 0) {
      return -1;
    }
    const candidate = tokens[index]!;
    return candidate.value === 'in' && !candidate.quoted ? index : -1;
  }
}
