import { TopBar } from './TopBar';
import { FilterBar } from '../FilterBar/FilterBar';
import { FiltersOverflowModal } from '../FilterBar/FiltersOverflowModal';

type PageHeaderProps = {
  view: 'grid' | 'cards';
};

// Same components at every width - CSS alone repaints TopBar/FilterBar for
// narrower viewports, so there's exactly one render tree to reuse across
// Grid and Cards, desktop and mobile.
export function PageHeader({ view }: PageHeaderProps) {
  return (
    <>
      <TopBar />
      <FilterBar view={view} />
      <FiltersOverflowModal view={view} />
    </>
  );
}
