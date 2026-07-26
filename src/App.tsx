import { AppProvider, useApp } from './state/AppContext';
import { GridPlanner } from './components/GridPlanner/GridPlanner';
import { CardBrowser } from './components/CardBrowser/CardBrowser';
import { SyncSheet } from './components/SyncSheet/SyncSheet';

function AppContent() {
  const { state } = useApp();
  return (
    <>
      {state.viewMode === 'grid' ? <GridPlanner /> : <CardBrowser />}
      <SyncSheet />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
