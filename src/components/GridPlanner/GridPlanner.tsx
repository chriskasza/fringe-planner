import { DayStrip } from './DayStrip';
import { GridBody } from './GridBody';
import { DetailPanel } from './DetailPanel';
import { MyFringePanel } from '../MyFringePanel/MyFringePanel';
import { PageHeader } from '../PageHeader/PageHeader';
import styles from './GridPlanner.module.css';

export function GridPlanner() {
  return (
    <div data-testid="grid-planner" className={styles['grid-planner']}>
      <PageHeader view="grid" />
      <DayStrip />
      <div className={styles['grid-planner__content']}>
        <GridBody />
        <DetailPanel />
        <MyFringePanel />
      </div>
    </div>
  );
}
