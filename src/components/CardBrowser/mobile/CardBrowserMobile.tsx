import { PageHeaderMobile } from '../../PageHeader/PageHeader';
import { CardGrid } from '../CardGrid';
import './CardBrowserMobile.css';

export function CardBrowserMobile() {
  return (
    <div className="card-browser-mobile">
      <PageHeaderMobile view="cards" />
      <div className="card-browser-mobile__content">
        <CardGrid />
      </div>
    </div>
  );
}
