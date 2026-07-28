import { PageHeader } from '../PageHeader/PageHeader';
import { CardGrid } from './CardGrid';
import { DetailPanel } from '../GridPlanner/DetailPanel';
import { MyFringePanel } from '../MyFringePanel/MyFringePanel';
import styles from './CardBrowser.module.css';

export function CardBrowser() {
  return (
    <div data-testid="card-browser" className={styles['card-browser']}>
      <PageHeader view="cards" />
      <div className={styles['card-browser__content']}>
        <CardGrid />
        <DetailPanel />
        <MyFringePanel />
      </div>
    </div>
  );
}
