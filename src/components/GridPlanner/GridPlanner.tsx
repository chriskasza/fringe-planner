import { DayStrip } from './DayStrip';
import { GridBody } from './GridBody';
import { DetailPanel } from './DetailPanel';
import { PageHeader } from '../PageHeader/PageHeader';
import { GridPlannerMobile } from './mobile/GridPlannerMobile';
import styles from './GridPlanner.module.css';

export function GridPlanner() {
  return (
    <div className={styles['grid-planner-responsive']}>
      <div data-testid="grid-planner-desktop" className={styles['grid-planner-responsive__desktop']}>
        <div data-testid="grid-planner" className={styles['grid-planner']}>
          <PageHeader view="grid" />
          <DayStrip />
          <div className={styles['grid-planner__content']}>
            <GridBody />
            <DetailPanel />
          </div>
        </div>
      </div>
      <div data-testid="grid-planner-mobile" className={styles['grid-planner-responsive__mobile']}>
        <GridPlannerMobile />
      </div>
    </div>
  );
}
