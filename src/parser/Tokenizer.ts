import { InvalidArgumentError } from '../model/errors';

export interface Token {
  readonly value: string;
  readonly quoted: boolean;
}

/**
 * Line -> tokens. `#` only starts a comment at the start of a line, so colour
 * literals like `#ffffff` survive as ordinary tokens (spec §2).
 */
export class Tokenizer {
  public tokenize(line: string): Token[] {
    if (line.trimStart().startsWith('#')) {
      return [];
    }

    const tokens: Token[] = [];
    let cursor = 0;

    while (cursor < line.length) {
      const ch = line[cursor]!;
      if (ch === ' ' || ch === '\t') {
        cursor += 1;
        continue;
      }
      if (ch === '"') {
        const end = line.indexOf('"', cursor + 1);
        if (end === -1) {
          throw new InvalidArgumentError('unterminated quoted string');
        }
        tokens.push({ value: line.slice(cursor + 1, end), quoted: true });
        cursor = end + 1;
        continue;
      }
      let end = cursor;
      while (end < line.length && line[end] !== ' ' && line[end] !== '\t') {
        end += 1;
      }
      tokens.push({ value: line.slice(cursor, end), quoted: false });
      cursor = end;
    }

    return tokens;
  }
}
