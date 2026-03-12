import { describe, it, expect } from 'vitest';
import { parseParamFile, compareParams } from '@/lib/formats/param-file-parser';

describe('parseParamFile', () => {
  it('parses ArduPilot .param file format (space-separated)', () => {
    const text = `ARMING_CHECK 1
BATT_MONITOR 4
RC1_MIN 1100
RC1_MAX 1900`;
    const params = parseParamFile(text);
    expect(params).toHaveLength(4);
    expect(params[0]).toEqual({ name: 'ARMING_CHECK', value: 1 });
    expect(params[1]).toEqual({ name: 'BATT_MONITOR', value: 4 });
    expect(params[3]).toEqual({ name: 'RC1_MAX', value: 1900 });
  });

  it('parses comma-separated format', () => {
    const text = `ARMING_CHECK,1
BATT_MONITOR,4`;
    const params = parseParamFile(text);
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({ name: 'ARMING_CHECK', value: 1 });
  });

  it('skips comment lines starting with #', () => {
    const text = `# This is a comment
ARMING_CHECK 1
# Another comment
BATT_MONITOR 4`;
    const params = parseParamFile(text);
    expect(params).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(parseParamFile('')).toEqual([]);
  });

  it('skips blank lines', () => {
    const text = `ARMING_CHECK 1

BATT_MONITOR 4

`;
    const params = parseParamFile(text);
    expect(params).toHaveLength(2);
  });

  it('handles floating point values', () => {
    const text = `ATC_RAT_RLL_P 0.135
ATC_RAT_RLL_I 0.135
ATC_RAT_RLL_D 0.0036`;
    const params = parseParamFile(text);
    expect(params).toHaveLength(3);
    expect(params[0].value).toBeCloseTo(0.135);
    expect(params[2].value).toBeCloseTo(0.0036);
  });
});

describe('compareParams', () => {
  it('detects changed params', () => {
    const fileParams = [{ name: 'ARMING_CHECK', value: 0 }];
    const fcParams = new Map([['ARMING_CHECK', 1]]);
    const diffs = compareParams(fileParams, fcParams);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('changed');
    expect(diffs[0].fileValue).toBe(0);
    expect(diffs[0].fcValue).toBe(1);
  });

  it('detects added params (in file but not on FC)', () => {
    const fileParams = [{ name: 'NEW_PARAM', value: 42 }];
    const fcParams = new Map<string, number>();
    const diffs = compareParams(fileParams, fcParams);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('added');
    expect(diffs[0].fcValue).toBeNull();
  });

  it('detects unchanged params', () => {
    const fileParams = [{ name: 'ARMING_CHECK', value: 1 }];
    const fcParams = new Map([['ARMING_CHECK', 1]]);
    const diffs = compareParams(fileParams, fcParams);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('unchanged');
  });

  it('sorts results: changed first, then added, then unchanged', () => {
    const fileParams = [
      { name: 'UNCHANGED', value: 1 },
      { name: 'CHANGED', value: 2 },
      { name: 'ADDED', value: 3 },
    ];
    const fcParams = new Map([
      ['UNCHANGED', 1],
      ['CHANGED', 99],
    ]);
    const diffs = compareParams(fileParams, fcParams);
    expect(diffs[0].status).toBe('changed');
    expect(diffs[1].status).toBe('added');
    expect(diffs[2].status).toBe('unchanged');
  });
});

describe('export then re-parse (round trip)', () => {
  it('re-parses exported param format', () => {
    const params = [
      { name: 'ARMING_CHECK', value: 1 },
      { name: 'BATT_MONITOR', value: 4 },
    ];
    // Build param file string
    const text = params.map((p) => `${p.name} ${p.value}`).join('\n');
    const parsed = parseParamFile(text);
    expect(parsed).toEqual(params);
  });
});
