import { AppProvider, useApp } from './state/AppContext';
import { GridPlanner } from './components/GridPlanner/GridPlanner';
import { CardBrowser } from './components/CardBrowser/CardBrowser';
import { SyncSheet } from './components/SyncSheet/SyncSheet';
import { MyFringePanel } from './components/MyFringePanel/MyFringePanel';

function AppContent() {
  const { state } = useApp();
  return (
    <>
      {state.viewMode === 'grid' ? <GridPlanner /> : <CardBrowser />}
      <MyFringePanel />
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
