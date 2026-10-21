const { toCsv, escapeCell } = require('../../src/utils/csv');
const { generateRegistrationCode, CODE_PATTERN } = require('../../src/utils/registrationCode');

describe('registration codes', () => {
  test('look like EVT-XXXXXX with no look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRegistrationCode();
      expect(code).toMatch(CODE_PATTERN);
      expect(code.slice(4)).not.toMatch(/[01OIL]/);
    }
  });
});

describe('CSV builder', () => {
  test('quotes every cell and doubles inner quotes', () => {
    expect(escapeCell('Say "hi"')).toBe('"Say ""hi"""');
  });

  test('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(escapeCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
    expect(escapeCell('@cmd')).toBe('"\'@cmd"');
  });

  test('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = toCsv(['Name'], [['Sara']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿"Name"\r\n"Sara"\r\n');
  });
});
