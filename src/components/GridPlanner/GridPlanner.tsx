import { DayStrip } from './DayStrip';
import { GridBody } from './GridBody';
import { DetailPanel } from './DetailPanel';
import { PageHeader } from '../PageHeader/PageHeader';
import { GridPlannerMobile } from './mobile/GridPlannerMobile';
import './GridPlanner.css';

export function GridPlanner() {
  return (
    <div className="grid-planner-responsive">
      <div className="grid-planner-responsive__desktop">
        <div className="grid-planner">
          <PageHeader view="grid" />
          <DayStrip />
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
