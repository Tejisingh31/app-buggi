import { describe, expect, it } from 'vitest';
import { formattaData, formattaEuro } from './formattazione';

describe('formattaEuro', () => {
  it('usa il punto per le migliaia e la virgola per i decimali', () => {
    expect(formattaEuro(123450)).toBe('1.234,50 €');
    expect(formattaEuro(123456789)).toBe('1.234.567,89 €');
  });
  it('gestisce importi piccoli, zero e negativi', () => {
    expect(formattaEuro(0)).toBe('0,00 €');
    expect(formattaEuro(5)).toBe('0,05 €');
    expect(formattaEuro(-1050)).toBe('-10,50 €');
  });
});

describe('formattaData', () => {
  it('formatta come gg/mm/aaaa', () => {
    expect(formattaData(new Date(2026, 10, 20))).toBe('20/11/2026');
    expect(formattaData(new Date(2026, 0, 5))).toBe('05/01/2026');
  });
});
