import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { TopBar } from './TopBar';
import { DayStrip } from './DayStrip';
import { GridBody } from './GridBody';
import { DetailPanel } from './DetailPanel';
import { FilterBar } from '../FilterBar/FilterBar';
import { GridPlannerMobile } from './mobile/GridPlannerMobile';
import './GridPlanner.css';

export function GridPlanner() {
  const { state, shows } = useApp();

  const visibleCount = useMemo(
    () =>
      shows.filter(
        (s) => visible(s, state, shows) && s.perfs.some((p) => p.status === 'active' && p.day === state.gridDay),
      ).length,
    [shows, state],
  );

  return (
    <div className="grid-planner-responsive">
      <div className="grid-planner-responsive__desktop">
        <div className="grid-planner">
          <TopBar />
          <DayStrip />
          <FilterBar view="grid" visibleCount={visibleCount} countLabel="ON THE GRID" />
          <div className="grid-planner__content">
            <GridBody />
            <DetailPanel />
          </div>
        </div>
      </div>
      <div className="grid-planner-responsive__mobile">
        <GridPlannerMobile />
      </div>
    </div>
  );
}
