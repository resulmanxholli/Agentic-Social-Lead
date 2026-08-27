import { useState } from 'react';
import StatusWidget from './components/StatusWidget';
import LeadsPage from './pages/LeadsPage';
import KeywordsPage from './pages/KeywordsPage';

type Tab = 'leads' | 'keywords';

function App() {
  const [tab, setTab] = useState<Tab>('leads');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Social Lead Monitor</h1>
            <nav className="mt-2 flex gap-4 text-sm font-medium">
              <button
                type="button"
                onClick={() => setTab('leads')}
                className={tab === 'leads' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}
              >
                Leads
              </button>
              <button
                type="button"
                onClick={() => setTab('keywords')}
                className={tab === 'keywords' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}
              >
                Keywords
              </button>
            </nav>
          </div>
          <StatusWidget />
        </div>
      </header>
      <main>{tab === 'leads' ? <LeadsPage /> : <KeywordsPage />}</main>
    </div>
  );
}

export default App;
