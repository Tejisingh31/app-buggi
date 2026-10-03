import { serveBackup, giorniDallUltimoBackup } from '../backup/promemoria';
import type { Dati } from '../hooks/useDati';
import { vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import Pulsante from './Pulsante';

/** Banner in Dashboard quando l'ultimo backup è troppo vecchio. */
export default function PromemoriaBackup({ dati }: { dati: Dati }) {
  const oggi = oggiIso();
  const { ultimoBackup, promemoriaBackupGiorni } = dati.impostazioni;
  if (!serveBackup(ultimoBackup, promemoriaBackupGiorni, oggi, dati.persone.length > 0)) return null;
  const giorni = giorniDallUltimoBackup(ultimoBackup, oggi);
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
      <p className="text-base font-semibold">
        {giorni === null ? 'Non hai ancora fatto un backup' : `Ultimo backup ${giorni} giorni fa`}
      </p>
      <p className="mt-1 text-sm">
        I dati sono solo su questo telefono: se cancelli l'app li perdi. Salva una copia su iCloud, Google Drive o email.
      </p>
      <Pulsante className="mt-3" onClick={() => vai('/impostazioni')}>
        Fai il backup ora
      </Pulsante>
    </div>
  );
}
