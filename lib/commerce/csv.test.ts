import { describe, it, expect } from 'vitest';
import { csvCell, toCsv, csvFilename } from './csv';

describe('csvCell', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvCell('Blue Romper')).toBe('Blue Romper');
    expect(csvCell(1500)).toBe('1500');
    expect(csvCell(true)).toBe('true');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes a value containing a comma, so later columns do not shift', () => {
    expect(csvCell('12 Awolowo Road, Ikoyi')).toBe('"12 Awolowo Road, Ikoyi"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvCell('the "large" size')).toBe('"the ""large"" size"');
  });

  it('quotes a value containing a newline', () => {
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('quotes surrounding whitespace rather than letting a reader trim it', () => {
    expect(csvCell('  padded  ')).toBe('"  padded  "');
  });

  it('defuses a value a spreadsheet would run as a formula', () => {
    // Customer names and notes are attacker-controlled and end up in a file
    // the shop owner opens on their own machine.
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(csvCell('+44 7700 900000')).toBe("'+44 7700 900000");
    expect(csvCell('-1')).toBe("'-1");
  });

  it('quotes a defused value that also needs quoting', () => {
    expect(csvCell('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"');
  });

  it('does not treat a formula character in the middle as dangerous', () => {
    expect(csvCell('S=M')).toBe('S=M');
  });
});

describe('toCsv', () => {
  const columns = [
    { header: 'Name', value: (r: { name: string; qty: number }) => r.name },
    { header: 'Qty', value: (r: { name: string; qty: number }) => r.qty },
  ];

  it('writes a header row and CRLF line endings', () => {
    const csv = toCsv([{ name: 'Romper', qty: 2 }], columns);
    expect(csv).toBe('﻿Name,Qty\r\nRomper,2\r\n');
  });

  it('starts with a byte-order mark so Excel reads it as UTF-8', () => {
    // Without this, ₦ and every accented name arrive as mojibake.
    expect(toCsv([], columns).startsWith('﻿')).toBe(true);
  });

  it('still writes the header when there are no rows', () => {
    expect(toCsv([], columns)).toBe('﻿Name,Qty\r\n');
  });
});

describe('csvFilename', () => {
  it('dates the file so successive exports do not collide', () => {
    expect(csvFilename('orders', new Date('2026-09-05T10:00:00Z'))).toBe('orders-2026-09-05.csv');
  });
});
