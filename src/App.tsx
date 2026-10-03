import type { ReactNode } from 'react';
import { cartellaSupportata } from './backup/automatico';
import Report from './backup/report';
import { useBackupAutomatico } from './backup/useBackupAutomatico';
import SceltaCartella from './components/SceltaCartella';
import BarraSchede from './components/BarraSchede';
import GestorePagamenti from './components/GestorePagamenti';
import { aggiornaImpostazioni } from './db/repository';
import { useDati } from './hooks/useDati';
import { useTema } from './hooks/useTema';
import { schedaDi, useRotta, vai } from './navigazione';
import Benvenuto from './pages/Benvenuto';
import Dashboard from './pages/Dashboard';
import Impostazioni from './pages/Impostazioni';
import Mancanti from './pages/Mancanti';
import ModuloPersona from './pages/ModuloPersona';
import ModuloPiano from './pages/ModuloPiano';
import Persone from './pages/Persone';
import SchedaPersona from './pages/SchedaPersona';
import BloccoPin from './sicurezza/BloccoPin';
import ImpostaPin from './sicurezza/ImpostaPin';
import { useBlocco } from './sicurezza/useBlocco';

/** Schermata intera senza barra in basso (blocco, benvenuto, PIN). */
function SchermoIntero({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">{children}</div>;
}

export default function App() {
  const rotta = useRotta();
  const dati = useDati();
  const imp = dati?.impostazioni;
  useTema(imp?.tema, imp?.accento);
  const blocco = useBlocco(imp);
  useBackupAutomatico(!!imp);

  // finché non si sa se c'è un PIN non si mostra nessun dato
  if (!dati || !imp || !blocco.pronto) return <SchermoIntero>{null}</SchermoIntero>;

  if (blocco.bloccata) {
    return (
      <SchermoIntero>
        <BloccoPin attesaIniziale={imp.pinBloccatoFino} onSbloccato={blocco.sblocca} />
      </SchermoIntero>
    );
  }

  // primo avvio: app vuota e schermata di benvenuto mai vista
  if (!imp.benvenutoVisto && dati.persone.length === 0) {
    return (
      <SchermoIntero>
        <Benvenuto />
      </SchermoIntero>
    );
  }

  // subito dopo il primo avvio si propone il PIN (si può saltare)
  if (!imp.pinHash && !imp.pinProposto) {
    return (
      <SchermoIntero>
        <main className="mx-auto max-w-xl px-6 py-10">
          <h1 className="text-center text-2xl font-bold text-slate-900">Proteggi Buggi con un PIN</h1>
          <p className="mt-2 mb-8 text-center text-base text-slate-600">
            Il PIN viene chiesto ogni volta che apri l'app. Se lo dimentichi non si può recuperare: dovrai reimpostare l'app e ripristinare un
            backup.
          </p>
          <ImpostaPin onFatto={() => undefined} />
          <button
            type="button"
            onClick={() => aggiornaImpostazioni({ pinProposto: true })}
            className="mx-auto mt-8 block min-h-11 px-4 text-base font-medium text-teal-700 underline"
          >
            Non ora (puoi impostarlo dopo in Impostazioni)
          </button>
        </main>
      </SchermoIntero>
    );
  }

  // poi, dove il browser lo permette, si chiede una volta sola dove salvare i backup automatici
  if (!imp.cartellaProposta && imp.backupAutomatico !== false && cartellaSupportata()) {
    return (
      <SchermoIntero>
        <main className="mx-auto max-w-xl px-6 py-10">
          <h1 className="text-center text-2xl font-bold text-slate-900">Dove salvo i backup automatici?</h1>
          <p className="mt-2 mb-8 text-center text-base text-slate-600">
            Ogni giorno Buggi salverà da solo una copia dei dati in una cartella del computer. Ti consiglio <strong>Documenti</strong>:
            dentro verrà creata la cartella «Buggi backup».
          </p>
          <SceltaCartella onFatto={() => aggiornaImpostazioni({ cartellaProposta: true })} />
          <button
            type="button"
            onClick={() => aggiornaImpostazioni({ cartellaProposta: true })}
            className="mx-auto mt-8 block min-h-11 px-4 text-base font-medium text-teal-700 underline"
          >
            Non ora (puoi sceglierla dopo in Impostazioni)
          </button>
        </main>
      </SchermoIntero>
    );
  }

  let pagina;
  switch (rotta.pagina) {
    case 'dashboard':
      pagina = <Dashboard />;
      break;
    case 'persone':
      pagina = <Persone />;
      break;
    case 'mancanti':
      pagina = <Mancanti />;
      break;
    case 'impostazioni':
      pagina = <Impostazioni />;
      break;
    case 'report':
      pagina = <Report />;
      break;
    case 'nuovaPersona':
      pagina = <ModuloPersona />;
      break;
    case 'persona':
      pagina = <SchedaPersona id={rotta.id} />;
      break;
    case 'modificaPersona':
      pagina = <ModuloPersona id={rotta.id} />;
      break;
    case 'nuovoPiano':
      pagina = <ModuloPiano personaId={rotta.personaId} />;
      break;
    case 'modificaPiano':
      pagina = <ModuloPiano personaId={rotta.personaId} pianoId={rotta.pianoId} />;
      break;
  }

  return (
    <GestorePagamenti>
      {/* spazio in fondo per la barra delle schede e il pulsante + */}
      <div className="min-h-full bg-slate-50 pt-[env(safe-area-inset-top)] pb-[calc(10rem+env(safe-area-inset-bottom))] print:bg-white print:p-0">
        <main>{pagina}</main>
        <BarraSchede attiva={schedaDi(rotta)} onCambia={(scheda) => vai(`/${scheda}`)} />
      </div>
    </GestorePagamenti>
  );
}
