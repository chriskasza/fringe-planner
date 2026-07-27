import { DayStrip } from '../DayStrip';
import { GridBody } from '../GridBody';
import { DetailPanel } from '../DetailPanel';
import { PageHeaderMobile } from '../../PageHeader/PageHeader';
import { MOBILE_LABEL_WIDTH } from '../gridLayout';
import './GridPlannerMobile.css';

export function GridPlannerMobile() {
  return (
    <div className="grid-planner-mobile">
      <PageHeaderMobile view="grid" />
      <DayStrip compact />
      <div className="grid-planner-mobile__content">
        <GridBody labelWidth={MOBILE_LABEL_WIDTH} compact />
      </div>
      <DetailPanel />
    </div>
  );
}
