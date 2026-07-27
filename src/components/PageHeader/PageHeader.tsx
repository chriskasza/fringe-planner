import { TopBar } from './TopBar';
import { FilterBar } from '../FilterBar/FilterBar';
import { MobileFiltersButton, MobileFiltersPanel } from '../FilterBar/MobileFiltersPanel';

type PageHeaderProps = {
  view: 'grid' | 'cards';
  visibleCount: number;
  countLabel: string;
};

export function PageHeader({ view, visibleCount, countLabel }: PageHeaderProps) {
  return (
    <>
      <TopBar />
      <FilterBar view={view} visibleCount={visibleCount} countLabel={countLabel} />
    </>
  );
}

type PageHeaderMobileProps = {
  view: 'grid' | 'cards';
};

export function PageHeaderMobile({ view }: PageHeaderMobileProps) {
  return (
    <>
      <TopBar compact rightExtra={<MobileFiltersButton view={view} />} />
      <MobileFiltersPanel view={view} />
    </>
  );
}
