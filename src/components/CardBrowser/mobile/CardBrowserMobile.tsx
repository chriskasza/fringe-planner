import { TopBar } from '../../GridPlanner/TopBar';
import { MobileFiltersButton, MobileFiltersPanel } from '../../FilterBar/MobileFiltersPanel';
import { CardGrid } from '../CardGrid';
import './CardBrowserMobile.css';

export function CardBrowserMobile() {
  return (
    <div className="card-browser-mobile">
      <TopBar compact rightExtra={<MobileFiltersButton view="cards" />} />
      <MobileFiltersPanel view="cards" />
      <div className="card-browser-mobile__content">
        <CardGrid />
      </div>
    </div>
  );
}
