import { useEffect, useState } from 'react';

// The app's one "compact" breakpoint (see CLAUDE.md) as a JS-readable value,
// for the handful of things CSS alone can't decide - e.g. the grid's
// per-slot pixel width, which pixel-positioned blocks (gridLayout.ts) need
// as a number, not a media query.
export const NARROW_QUERY = '(max-width: 700px)';

export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    const onChange = () => setIsNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isNarrow;
}
