import { TopBar } from './TopBar';
import { FilterBar } from '../FilterBar/FilterBar';
import { FiltersOverflowModal } from '../FilterBar/FiltersOverflowModal';

type PageHeaderProps = {
  view: 'grid' | 'cards';
  visibleCount?: number;
  countLabel?: string;
};

// Same FilterBar at every width - it collapses its own inline filters down to
// however many fit (0 on the narrowest phones), so desktop and mobile share
// one implementation here too; only TopBar's `compact` brand treatment
// differs between them.
function Header({ view, visibleCount, countLabel, compact }: PageHeaderProps & { compact: boolean }) {
  return (
    <>
      <TopBar compact={compact} />
      <FilterBar view={view} visibleCount={visibleCount} countLabel={countLabel} />
      <FiltersOverflowModal view={view} />
    </>
  );
}

export function PageHeader(props: PageHeaderProps) {
  return <Header {...props} compact={false} />;
}

export function PageHeaderMobile({ view }: { view: 'grid' | 'cards' }) {
  return <Header view={view} compact />;
}
