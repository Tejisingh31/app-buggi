import ImportaBackup from '../components/ImportaBackup';
import Pulsante from '../components/Pulsante';
import { aggiornaImpostazioni } from '../db/repository';

/** Schermata del primo avvio: "Inizia da zero" o "Ripristina da backup" (es. cambio telefono). */
export default function Benvenuto() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-10">
      <img
        src={`${import.meta.env.BASE_URL}logo/buggi-logo.png`}
        alt="Logo di Buggi"
        width={768}
        height={512}
        className="mx-auto aspect-[3/2] w-full max-w-sm rounded-3xl shadow-lg"
      />
      <h1 className="mt-6 text-center text-3xl font-bold text-slate-900">Benvenuto in Buggi</h1>
      <p className="mt-3 text-center text-lg text-slate-600">
        Registra chi deve pagare, quanto e quando. I dati restano solo su questo telefono.
      </p>

      <div className="mt-10 space-y-4">
        <Pulsante largo className="min-h-16 text-lg" onClick={() => aggiornaImpostazioni({ benvenutoVisto: true })}>
          Inizia da zero
        </Pulsante>
        <ImportaBackup etichetta="Ripristina da backup" soloSostituisci onFatto={() => undefined} />
        <p className="text-center text-sm text-slate-500">
          Hai cambiato telefono? Scegli «Ripristina da backup» e apri il file <em>pagamenti-backup-….json</em> salvato dal vecchio telefono.
        </p>
      </div>
    </main>
  );
}
