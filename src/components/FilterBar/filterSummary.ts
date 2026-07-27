// Filter buttons summarize their selection, they never enumerate it - the bar
// must never grow with the number of active selections (design rule).
//
// One grammar for every filter: `ALL n` / `NONE` / `n OF m`. Day and Time
// additionally name the single selection when there is exactly one, because
// their labels are short enough to read inline ("FRI 4 SEP", "EVENING");
// Venue, Age & content and Shows always stay numeric, since a single venue
// or rating name would stretch the bar.
export function summarizeSelected(selected: number, total: number): string {
  if (selected === total) return `ALL ${total}`;
  if (selected === 0) return 'NONE';
  return `${selected} OF ${total}`;
}

export function summarizeLabelled(
  onMap: Record<string, boolean>,
  allKeys: string[],
  labelFor: (key: string) => string,
): string {
  const selected = allKeys.filter((k) => onMap[k]);
  if (selected.length === 1) return labelFor(selected[0]);
  return summarizeSelected(selected.length, allKeys.length);
}

export function summarizeCount(onMap: Record<string, boolean>, allKeys: string[]): string {
  return summarizeSelected(allKeys.filter((k) => onMap[k]).length, allKeys.length);
}

// Single number for the mobile "Filters · N" button - counts every switched-
// off day/time/venue/rating, every excluded show, and clash mode if it's off
// its default.
//
// `query` is deliberately NOT counted. It's a search box *inside* the Shows
// panel that narrows which shows are listed there to tick/untick; it doesn't
// filter the grid (see `visible`). Counting it made the badge claim a filter
// was active while nothing on screen had changed.
export function activeFilterCount(args: {
  daysOn: Record<string, boolean>;
  timeBucketsOn: Record<string, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  warningsOn: Record<string, boolean>;
  excluded: Record<string, boolean>;
  clash: string;
}): number {
  const countOff = (map: Record<string, boolean>) => Object.values(map).filter((v) => v === false).length;
  return (
    countOff(args.daysOn) +
    countOff(args.timeBucketsOn) +
    countOff(args.venuesOn) +
    countOff(args.ratingsOn) +
    countOff(args.warningsOn) +
    Object.values(args.excluded).filter(Boolean).length +
    (args.clash !== 'show' ? 1 : 0)
  );
}

const RATING_ORDER = ['All', '5+', '8+', '12+', '14+', '16+', '18+', 'NOT RATED'];

export function sortRatings(ratings: string[]): string[] {
  return [...ratings].sort((a, b) => {
    const ai = RATING_ORDER.indexOf(a);
    const bi = RATING_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
