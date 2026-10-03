import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { conteggi } from '../db/repository';
import { spazioPersistente } from '../db/persistenza';

/** Riquadro che mostra quanti dati sono salvati sul telefono e se lo spazio è protetto. */
export default function StatoArchivio() {
  const numeri = useLiveQuery(conteggi);
  const [protetto, setProtetto] = useState<boolean | null>(null);

  useEffect(() => {
    void spazioPersistente().then(setProtetto);
  }, []);

  const righe: [string, number | undefined][] = [
    ['Persone', numeri?.persone],
    ['Quote', numeri?.piani],
    ['Scadenze', numeri?.scadenze],
    ['Pagamenti', numeri?.pagamenti],
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Dati sul telefono</h2>
      <dl className="grid grid-cols-2 gap-2">
        {righe.map(([etichetta, valore]) => (
          <div key={etichetta} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-sm text-slate-500">{etichetta}</dt>
            <dd className="text-2xl font-bold text-slate-900">{valore ?? '…'}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-slate-600">
        {protetto === null && 'Controllo spazio in corso…'}
        {protetto === true && '✓ Spazio protetto: il telefono non cancellerà i dati da solo.'}
        {protetto === false &&
          "Spazio non protetto: il telefono potrebbe cancellare i dati se resta senza memoria. Installa l'app sulla schermata Home e fai backup regolari."}
      </p>
    </div>
  );
}
