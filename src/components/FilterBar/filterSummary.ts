// Filter buttons summarize their selection, they never enumerate it - the bar
// must never grow with the number of active selections (design rule).

// Day/Time: short enough labels that showing the single selected one reads
// better than a bare count ("FRI 4 SEP", "EVENING").
export function summarizeLabelled(
  onMap: Record<string, boolean>,
  allKeys: string[],
  labelFor: (key: string) => string,
): string {
  const selected = allKeys.filter((k) => onMap[k]);
  if (selected.length === allKeys.length) return `ALL ${allKeys.length}`;
  if (selected.length === 1) return labelFor(selected[0]);
  if (selected.length === 0) return 'NONE';
  return `${selected.length} OF ${allKeys.length}`;
}

// Venue/Age & content: labels are too long or numerous to show inline, so
// always summarize as a count ("4 OF 6", "ALL 6", "1").
export function summarizeCount(onMap: Record<string, boolean>, allKeys: string[]): string {
  const selected = allKeys.filter((k) => onMap[k]).length;
  if (selected === allKeys.length) return `ALL ${allKeys.length}`;
  if (selected === 0) return 'NONE';
  return String(selected);
}

// Single number for the mobile "Filters · N" button - counts every switched-
// off day/time/venue/rating, every excluded show, plus clash mode and search
// query if they're off their defaults.
export function activeFilterCount(args: {
  daysOn: Record<string, boolean>;
  timeBucketsOn: Record<string, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  excluded: Record<string, boolean>;
  clash: string;
  query: string;
}): number {
  const countOff = (map: Record<string, boolean>) => Object.values(map).filter((v) => v === false).length;
  return (
    countOff(args.daysOn) +
    countOff(args.timeBucketsOn) +
    countOff(args.venuesOn) +
    countOff(args.ratingsOn) +
    Object.values(args.excluded).filter(Boolean).length +
    (args.clash !== 'all' ? 1 : 0) +
    (args.query.trim() ? 1 : 0)
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
