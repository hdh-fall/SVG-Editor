import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../../src/parser/Tokenizer';
import { InvalidArgumentError } from '../../src/model/errors';

const tokenizer = new Tokenizer();

describe('Tokenizer', () => {
  it('splits on runs of whitespace', () => {
    expect(tokenizer.tokenize('move   r1   10   20').map((t) => t.value)).toEqual([
      'move',
      'r1',
      '10',
      '20',
    ]);
  });

  it('treats a leading # as a whole-line comment', () => {
    expect(tokenizer.tokenize('# create rect r1 0 0 1 1')).toEqual([]);
    expect(tokenizer.tokenize('   # indented comment')).toEqual([]);
  });

  it('does NOT treat a mid-line # as a comment (colour literals)', () => {
    expect(tokenizer.tokenize('create rect r1 0 0 1 1 #ffffff').at(-1)).toEqual({
      value: '#ffffff',
      quoted: false,
    });
  });

  it('keeps a quoted string as one token and drops the quotes', () => {
    expect(tokenizer.tokenize('create text t1 20 40 "My Diagram"')).toEqual([
      { value: 'create', quoted: false },
      { value: 'text', quoted: false },
      { value: 't1', quoted: false },
      { value: '20', quoted: false },
      { value: '40', quoted: false },
      { value: 'My Diagram', quoted: true },
    ]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => tokenizer.tokenize('create text t1 0 0 "oops')).toThrow(InvalidArgumentError);
  });
});
