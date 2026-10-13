import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';

const parser = new CommandParser();

describe('CommandParser', () => {
  it('returns null for blank lines and comments', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse('   ')).toBeNull();
    expect(parser.parse('# a comment')).toBeNull();
  });

  it('separates the command name from its arguments', () => {
    expect(parser.parse('create rect r1 0 0 10 5')).toEqual({
      name: 'create',
      positional: ['rect', 'r1', '0', '0', '10', '5'],
      inContainer: null,
    });
  });

  it('extracts a trailing `in <container>` clause', () => {
    expect(parser.parse('create rect r1 0 0 10 5 in node1')).toEqual({
      name: 'create',
      positional: ['rect', 'r1', '0', '0', '10', '5'],
      inContainer: 'node1',
    });
  });

  it('does not mistake a quoted "in" for the clause', () => {
    expect(parser.parse('set title text "in"')).toEqual({
      name: 'set',
      positional: ['title', 'text', 'in'],
      inContainer: null,
    });
  });

  it('keeps a quoted argument with spaces intact', () => {
    expect(parser.parse('set title text "My Diagram v2"')).toEqual({
      name: 'set',
      positional: ['title', 'text', 'My Diagram v2'],
      inContainer: null,
    });
  });
});
