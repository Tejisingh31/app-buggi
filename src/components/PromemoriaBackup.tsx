import { giorniDallUltimoBackup, serveBackup } from '../backup/promemoria';
import type { Dati } from '../hooks/useDati';
import { vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import Pulsante from './Pulsante';

/**
 * Promemoria del backup in Dashboard. Compare SOLO se l'utente l'ha attivato
 * (Impostazioni → Preferenze → "Ricordami in Dashboard di fare il backup").
 */
export default function PromemoriaBackup({ dati }: { dati: Dati }) {
  const { ultimoBackup, promemoriaBackupGiorni, promemoriaInHome } = dati.impostazioni;
  const oggi = oggiIso();
  if (!promemoriaInHome || !serveBackup(ultimoBackup, promemoriaBackupGiorni, oggi, dati.persone.length > 0)) return null;
  const giorni = giorniDallUltimoBackup(ultimoBackup, oggi);
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
      <p className="text-base font-semibold">
        {giorni === null ? 'Salva una copia fuori dal telefono' : `Ultima copia fuori dal telefono: ${giorni} giorni fa`}
      </p>
      <p className="mt-1 text-sm">
        Ogni giorno l'app fa da sola una copia interna, ma se cancelli l'app si perde anche quella. Salva un backup su iCloud, Google
        Drive o email.
      </p>
      <Pulsante className="mt-3" onClick={() => vai('/impostazioni')}>
        Fai il backup ora
      </Pulsante>
    </div>
  );
}
