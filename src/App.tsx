import { AppProvider, useApp } from './state/AppContext';
import { perfKey } from './lib/derived';

function Inner() {
  const { state, dispatch, shows, days } = useApp();
  const perfCount = shows.reduce((n, s) => n + s.perfs.filter((p) => p.status === 'active').length, 0);
  const firstShow = shows[0];
  const firstPerf = firstShow.perfs[0];
  const key = perfKey(firstShow.id, firstPerf.day, firstPerf.start);

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--cream)' }}>
      <p>Halifax Fringe · Show Selector — scaffolding in progress</p>
      <p>
        {shows.length} shows · {perfCount} showtimes · {days.length} festival days
      </p>
      <p>picked: {state.picked.size}</p>
      <button type="button" onClick={() => dispatch({ type: 'TOGGLE_PICK', key })}>
        toggle pick: {firstShow.title}
      </button>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  );
}

export default App;
