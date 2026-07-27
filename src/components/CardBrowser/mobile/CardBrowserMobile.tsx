import { PageHeaderMobile } from '../../PageHeader/PageHeader';
import { CardGrid } from '../CardGrid';
import styles from './CardBrowserMobile.module.css';

export function CardBrowserMobile() {
  return (
    <div className={styles['card-browser-mobile']}>
      <PageHeaderMobile view="cards" />
      <div className={styles['card-browser-mobile__content']}>
        <CardGrid compact />
      </div>
    </div>
  );
}
