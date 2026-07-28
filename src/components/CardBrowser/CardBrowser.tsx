import { PageHeader } from '../PageHeader/PageHeader';
import { CardGrid } from './CardGrid';
import styles from './CardBrowser.module.css';

export function CardBrowser() {
  return (
    <div data-testid="card-browser" className={styles['card-browser']}>
      <PageHeader view="cards" />
      <div className={styles['card-browser__content']}>
        <CardGrid />
      </div>
    </div>
  );
}
