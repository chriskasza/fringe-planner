import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { TopBar } from '../GridPlanner/TopBar';
import { FilterBar } from '../FilterBar/FilterBar';
import { CardGrid } from './CardGrid';
import { MyFringeRail } from './MyFringeRail';
import './CardBrowser.css';

export function CardBrowser() {
  const { state, shows } = useApp();

  const visibleCount = useMemo(() => shows.filter((s) => visible(s, state, shows)).length, [shows, state]);

  return (
    <div className="card-browser">
      <TopBar />
      <FilterBar view="cards" visibleCount={visibleCount} countLabel="SHOWN" />
      <div className="card-browser__content">
        <CardGrid />
        <MyFringeRail />
      </div>
    </div>
  );
}
