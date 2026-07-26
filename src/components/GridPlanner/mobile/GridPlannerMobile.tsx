import { TopBar } from '../TopBar';
import { DayStrip } from '../DayStrip';
import { GridBody } from '../GridBody';
import { DetailPanel } from '../DetailPanel';
import { MobileFiltersButton, MobileFiltersPanel } from '../../FilterBar/MobileFiltersPanel';
import { MOBILE_LABEL_WIDTH } from '../gridLayout';
import './GridPlannerMobile.css';

export function GridPlannerMobile() {
  return (
    <div className="grid-planner-mobile">
      <TopBar compact rightExtra={<MobileFiltersButton view="grid" />} />
      <DayStrip compact />
      <MobileFiltersPanel view="grid" />
      <div className="grid-planner-mobile__content">
        <GridBody labelWidth={MOBILE_LABEL_WIDTH} compact />
      </div>
      <DetailPanel />
    </div>
  );
}
