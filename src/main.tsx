import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { richiediSpazioPersistente } from './db/persistenza';
import { sincronizzaScadenze } from './db/repository';
import { applicaTema, temaSalvato } from './hooks/useTema';
import './index.css';
import App from './App.tsx';

{
  const { tema, accento } = temaSalvato();
  applicaTema(tema, accento);
}
registerSW({ immediate: true });
void richiediSpazioPersistente();
sincronizzaScadenze().catch((e) => console.error('Generazione scadenze non riuscita', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
