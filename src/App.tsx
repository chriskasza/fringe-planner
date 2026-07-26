import { AppProvider } from './state/AppContext';
import { GridPlanner } from './components/GridPlanner/GridPlanner';

function App() {
  return (
    <AppProvider>
      <GridPlanner />
    </AppProvider>
  );
}

export default App;
