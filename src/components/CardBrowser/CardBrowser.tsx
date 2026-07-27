import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { PageHeader } from '../PageHeader/PageHeader';
import { CardGrid } from './CardGrid';
import { MyFringeRail } from './MyFringeRail';
import { CardBrowserMobile } from './mobile/CardBrowserMobile';
import './CardBrowser.css';

export function CardBrowser() {
  const { state, shows } = useApp();

  const visibleCount = useMemo(() => shows.filter((s) => visible(s, state, shows)).length, [shows, state]);

  return (
    <div className="card-browser-responsive">
      <div className="card-browser-responsive__desktop">
        <div className="card-browser">
          <PageHeader view="cards" visibleCount={visibleCount} countLabel="SHOWN" />
          <div className="card-browser__content">
            <CardGrid />
            <MyFringeRail />
          </div>
        </div>
      </div>
      <div className="card-browser-responsive__mobile">
        <CardBrowserMobile />
      </div>
    </div>
  );
}
