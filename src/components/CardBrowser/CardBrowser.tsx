import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { PageHeader } from '../PageHeader/PageHeader';
import { CardGrid } from './CardGrid';
import { MyFringeRail } from './MyFringeRail';
import { CardBrowserMobile } from './mobile/CardBrowserMobile';
import styles from './CardBrowser.module.css';

export function CardBrowser() {
  const { state, shows } = useApp();

  const visibleCount = useMemo(() => shows.filter((s) => visible(s, state, shows)).length, [shows, state]);

  return (
    <div className={styles['card-browser-responsive']}>
      <div className={styles['card-browser-responsive__desktop']}>
        <div data-testid="card-browser" className={styles['card-browser']}>
          <PageHeader view="cards" visibleCount={visibleCount} countLabel="SHOWN" />
          <div className={styles['card-browser__content']}>
            <CardGrid />
            <div className={styles['card-browser__rail']}>
              <MyFringeRail />
            </div>
          </div>
        </div>
      </div>
      <div className={styles['card-browser-responsive__mobile']}>
        <CardBrowserMobile />
      </div>
    </div>
  );
}
