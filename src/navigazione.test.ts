import { describe, expect, it } from 'vitest';
import { leggiRotta, percorso, schedaDi } from './navigazione';

describe('navigazione', () => {
  it('riconosce le pagine', () => {
    expect(leggiRotta('')).toEqual({ pagina: 'dashboard' });
    expect(leggiRotta('#/mancanti')).toEqual({ pagina: 'mancanti' });
    expect(leggiRotta('#/qualcosa')).toEqual({ pagina: 'dashboard' });
    expect(leggiRotta('#' + percorso.nuovaPersona())).toEqual({ pagina: 'nuovaPersona' });
    expect(leggiRotta('#' + percorso.persona('a b'))).toEqual({ pagina: 'persona', id: 'a b' });
    expect(leggiRotta('#' + percorso.modificaPersona('x'))).toEqual({ pagina: 'modificaPersona', id: 'x' });
    expect(leggiRotta('#' + percorso.nuovoPiano('x'))).toEqual({ pagina: 'nuovoPiano', personaId: 'x' });
    expect(leggiRotta('#' + percorso.modificaPiano('x', 'y'))).toEqual({ pagina: 'modificaPiano', personaId: 'x', pianoId: 'y' });
  });
  it('le pagine delle persone stanno nella scheda Persone', () => {
    expect(schedaDi({ pagina: 'modificaPiano', personaId: 'x', pianoId: 'y' })).toBe('persone');
    expect(schedaDi({ pagina: 'impostazioni' })).toBe('impostazioni');
    expect(leggiRotta('#/report')).toEqual({ pagina: 'report' });
    expect(schedaDi({ pagina: 'report' })).toBe('impostazioni');
  });
});
