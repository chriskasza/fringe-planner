import { createContext, useCallback, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { loadInitialFilters, useFilterPersistence } from '../lib/filterPersistence';
import { days, shows } from '../lib/loadData';
import { loadInitialPicked, usePersistence } from '../lib/persistence';
import { appReducer, createInitialState, type AppAction, type AppState } from '../lib/state';

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  shows: typeof shows;
  days: typeof days;
};

const AppContext = createContext<AppContextValue | null>(null);

function init(): AppState {
  const initial = createInitialState(days, shows);
  const filters = loadInitialFilters(initial, shows);
  return { ...initial, ...filters, picked: loadInitialPicked(shows) };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, init);

  const onExternalChange = useCallback((picked: AppState['picked']) => {
    dispatch({ type: 'SET_PICKED', picked });
  }, []);

  usePersistence(state.picked, shows, onExternalChange);
  useFilterPersistence(state);

  return (
    <AppContext.Provider value={{ state, dispatch, shows, days }}>{children}</AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
