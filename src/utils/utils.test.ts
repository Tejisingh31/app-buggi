import { describe, expect, it } from 'vitest';
import { descriviRegola } from './descrizioni';
import { importoPerInput, leggiImporto } from './importi';
import { linkChiamata, linkWhatsApp } from './telefono';
import { corrisponde, normalizza } from './testo';

describe('ricerca', () => {
  it('ignora maiuscole e accenti', () => {
    expect(normalizza('  Nicolò ÉLIA ')).toBe('nicolo elia');
    expect(corrisponde('nicolo', ['Nicolò Rossi'])).toBe(true);
    expect(corrisponde('ROSSI nic', ['Nicolò Rossi'])).toBe(true);
    expect(corrisponde('bianchi', ['Nicolò Rossi'])).toBe(false);
  });
  it('cerca anche in categoria e telefono, ignorando gli spazi del numero', () => {
    expect(corrisponde('squadra', ['Anna', 'Squadra A'])).toBe(true);
    expect(corrisponde('3331234', ['Anna', undefined, '333 123 4567'])).toBe(true);
  });
  it('una ricerca vuota trova tutti', () => {
    expect(corrisponde('   ', ['Anna'])).toBe(true);
  });
});

describe('importi scritti a mano', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['0,05', 5],
    ['1.234,50', 123450],
    ['1234.50', 123450],
    ['1.234', 123400],
    ['12 €', 1200],
  ])('%s → %i centesimi', (testo, centesimi) => {
    expect(leggiImporto(testo)).toBe(centesimi);
  });
  it.each(['', 'abc', '12,345', '-5', '1,2,3'])('"%s" non è valido', (testo) => {
    expect(leggiImporto(testo)).toBeNull();
  });
  it('torna nel formato del campo', () => {
    expect(importoPerInput(123450)).toBe('1234,50');
    expect(importoPerInput(5)).toBe('0,05');
  });
});

describe('telefono', () => {
  it('link per chiamare', () => {
    expect(linkChiamata('+39 333 123-4567')).toBe('tel:+393331234567');
  });
  it('link WhatsApp con prefisso italiano automatico', () => {
    expect(linkWhatsApp('333 123 4567')).toBe('https://wa.me/393331234567');
    expect(linkWhatsApp('+39 333 1234567')).toBe('https://wa.me/393331234567');
    expect(linkWhatsApp('0041 79 123 45 67')).toBe('https://wa.me/41791234567');
  });
});

describe('descrizione delle quote', () => {
  it('descrive ogni tipo a parole', () => {
    expect(descriviRegola({ frequenza: 'singola', dataInizio: '2026-11-20' })).toBe('Il 20/11/2026');
    expect(descriviRegola({ frequenza: 'mensile', dataInizio: '2026-01-01', giornoScadenza: 15 })).toBe('Ogni mese il giorno 15');
    expect(descriviRegola({ frequenza: 'ogniNMesi', intervalloMesi: 3, dataInizio: '2026-01-01', giornoScadenza: 1 })).toBe(
      'Ogni 3 mesi il giorno 1',
    );
    expect(descriviRegola({ frequenza: 'settimanale', dataInizio: '2026-01-01', giornoScadenza: 1 })).toBe('Ogni lunedì');
    expect(descriviRegola({ frequenza: 'annuale', dataInizio: '2026-01-01', giornoScadenza: 10, meseScadenza: 1 })).toBe(
      'Ogni anno il 10 gennaio',
    );
  });
});
