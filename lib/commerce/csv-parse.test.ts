import { describe, it, expect } from 'vitest';
import { parseCsv, isBlankRow, readCsvTable } from './csv-parse';

describe('parseCsv', () => {
  it('reads a plain file', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps a comma inside a quoted cell', () => {
    // The case that silently shifts every later column when split() is used.
    expect(parseCsv('name,address\nAda,"12 Awolowo Road, Ikoyi"')).toEqual([
      ['name', 'address'],
      ['Ada', '12 Awolowo Road, Ikoyi'],
    ]);
  });

  it('keeps a newline inside a quoted cell', () => {
    expect(parseCsv('note\n"line one\nline two"')).toEqual([['note'], ['line one\nline two']]);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsv('name\n"the ""large"" size"')).toEqual([['name'], ['the "large" size']]);
  });

  it('treats CRLF as one line ending', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles a lone CR, which some exports still emit', () => {
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('strips the byte-order mark Excel writes', () => {
    // Left in, it becomes part of the first header and no column ever matches.
    expect(parseCsv('﻿name,price\nRomper,1500')[0][0]).toBe('name');
  });

  it('does not invent a trailing row for a file ending in a newline', () => {
    expect(parseCsv('a\n1\n')).toEqual([['a'], ['1']]);
  });

  it('keeps empty cells rather than dropping them', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('isBlankRow', () => {
  it('recognises the trailing commas a spreadsheet leaves behind', () => {
    expect(isBlankRow(['', '', ''])).toBe(true);
    expect(isBlankRow(['   '])).toBe(true);
    expect(isBlankRow(['', 'x'])).toBe(false);
  });
});

describe('readCsvTable', () => {
  it('separates the header from the rows and trims header names', () => {
    const table = readCsvTable('  name , price \nRomper,1500\n');
    expect(table.headers).toEqual(['name', 'price']);
    expect(table.rows).toEqual([{ line: 2, cells: ['Romper', '1500'] }]);
  });

  it('numbers rows by their line in the original file', () => {
    // So an error says "line 4" and means the line the person can see, even
    // though a blank line was skipped.
    const table = readCsvTable('name\nRomper\n\nOnesie\n');
    expect(table.rows.map((r) => r.line)).toEqual([2, 4]);
  });

  it('skips leading blank lines when finding the header', () => {
    const table = readCsvTable('\n\nname,price\nRomper,1500');
    expect(table.headers).toEqual(['name', 'price']);
    expect(table.rows).toEqual([{ line: 4, cells: ['Romper', '1500'] }]);
  });

  it('returns nothing usable for an empty file', () => {
    expect(readCsvTable('')).toEqual({ headers: [], rows: [] });
  });
});
