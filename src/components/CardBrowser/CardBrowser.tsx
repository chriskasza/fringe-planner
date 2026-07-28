import { PageHeader } from '../PageHeader/PageHeader';
import { CardGrid } from './CardGrid';
import { MyFringeRail } from './MyFringeRail';
import styles from './CardBrowser.module.css';

export function CardBrowser() {
  return (
    <div data-testid="card-browser" className={styles['card-browser']}>
      <PageHeader view="cards" />
      <div className={styles['card-browser__content']}>
        <CardGrid />
        <div className={styles['card-browser__rail']}>
          <MyFringeRail />
        </div>
      </div>
    </div>
  );
}
