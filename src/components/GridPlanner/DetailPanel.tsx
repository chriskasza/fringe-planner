import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { perfIndex, perfState } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import styles from './DetailPanel.module.css';

const STATUS_LABEL: Record<string, string> = {
  picked: 'PICKED',
  'picked-clash': 'PICKED',
  clash: 'OVERLAPS',
  free: 'FREE SLOT',
};

export function DetailPanel() {
  const { state, dispatch, shows, days } = useApp();
  // Which show's description is expanded, rather than a plain boolean: the
  // panel stays mounted between openings, so a boolean would leave the next
  // show opening pre-expanded (and would need a reset effect to avoid it).
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  if (!state.detail) return null;

  const hit = perfIndex(shows).get(state.detail.timeId);
  if (!hit) return null;
  const { show, perf: primaryPerf } = hit;

  const dayLabel = days.find((d) => d.key === primaryPerf.day)?.label ?? primaryPerf.day;
  const pState = perfState(show, primaryPerf, state.picked, shows);
  const isPicked = pState === 'picked' || pState === 'picked-clash';

  const otherPerfs = show.perfs.filter((p) => p.status === 'active' && p.timeId !== primaryPerf.timeId);

  // Every perf of a cancelled show is cancelled, so the panel can only have
  // opened on a cancelled one. `otherPerfs` is already empty in that case;
  // what's left is to stop the panel offering the defunct slot as a pick.
  const cancelled = show.cancelled || primaryPerf.status !== 'active';

  // The blurb is the pin board's 256-character teaser; the description is the
  // untruncated version off the show's own page. Only offer the toggle when
  // there's something to expand into.
  const expandable = show.description.length > 0;
  const expanded = expandable && expandedFor === show.id;
  const descriptionId = `detail-description-${show.id}`;
  const toggle = (
    <button
      type="button"
      className={styles['detail-panel__more']}
      onClick={() => setExpandedFor(expanded ? null : show.id)}
      aria-expanded={expanded}
      aria-controls={expanded ? descriptionId : undefined}
    >
      {expanded ? 'LESS ▲' : '… MORE ▼'}
    </button>
  );

  return (
    <div data-testid="detail-panel" className={styles['detail-panel']}>
      <div className={styles['detail-panel__image']}>
        {show.poster ? (
          <img src={show.poster} alt="" loading="lazy" className={styles['detail-panel__image-img']} />
        ) : (
          <span className={styles['detail-panel__image-label']}>[ SHOW IMAGE ]</span>
        )}
        <button
          type="button"
          className={styles['detail-panel__close']}
          onClick={() => dispatch({ type: 'SET_DETAIL', detail: null })}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className={styles['detail-panel__body']}>
        <h2 className={styles['detail-panel__title']}>{show.title}</h2>
        {show.credits.length > 0 && <div className={styles['detail-panel__credits']}>{show.credits[0]}</div>}

        <div className={styles['detail-panel__spec']}>
          <span className={styles['detail-panel__spec-key']}>TIME</span>
          <span className={styles['detail-panel__spec-value']}>
            {cancelled ? 'CANCELLED' : `${dayLabel} · ${formatTime(primaryPerf.start)}–${formatTime(primaryPerf.end)}`}
          </span>
          <span className={styles['detail-panel__spec-key']}>VENUE</span>
          <span className={styles['detail-panel__spec-value']}>
            {show.venue}
            {show.venueAddress ? ` · ${show.venueAddress}` : ''}
          </span>
          <span className={styles['detail-panel__spec-key']}>LENGTH</span>
          <span className={styles['detail-panel__spec-value']}>{primaryPerf.mins} min</span>
          <span className={styles['detail-panel__spec-key']}>RATING</span>
          <span className={styles['detail-panel__spec-value']}>{show.rating}</span>
          {show.freeAdmission && (
            <>
              <span className={styles['detail-panel__spec-key']}>ADMISSION</span>
              <span className={styles['detail-panel__spec-value']}>FREE — no tickets required</span>
            </>
          )}
        </div>

        {expanded ? (
          <div id={descriptionId} className={styles['detail-panel__description']}>
            {show.description.map((paragraph, i) => (
              <p key={i} className={styles['detail-panel__blurb']}>
                {paragraph}
                {i === show.description.length - 1 && <> {toggle}</>}
              </p>
            ))}
          </div>
        ) : (
          <p className={styles['detail-panel__blurb']}>
            {show.blurb}
            {expandable && <> {toggle}</>}
          </p>
        )}

        {show.warnings.length > 0 && (
          <div>
            <div className={styles['detail-panel__warnings-label']}>CONTENT WARNING</div>
            <div className={styles['detail-panel__warnings']}>
              {show.warnings.map((w) => (
                <span key={w} className={styles['detail-panel__warning-chip']}>
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {otherPerfs.length > 0 && (
          <div className={styles['detail-panel__others']}>
            <div className={styles['detail-panel__others-label']}>OTHER PERFORMANCES</div>
            {otherPerfs.map((p) => {
              const timeId = p.timeId;
              const s = perfState(show, p, state.picked, shows);
              const label = days.find((d) => d.key === p.day)?.label ?? p.day;
              return (
                <button
                  key={timeId}
                  type="button"
                  className={styles['detail-panel__other-row']}
                  onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId })}
                >
                  <span>
                    {label} · {formatTime(p.start)}
                  </span>
                  <span className={`${styles['detail-panel__other-status']} ${styles[`detail-panel__other-status--${s}`]}`}>
                    {STATUS_LABEL[s]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles['detail-panel__footer']}>
          {!cancelled && (
            <button
              type="button"
              className={`${styles['detail-panel__primary']} ${isPicked ? styles['detail-panel__primary--remove'] : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId: primaryPerf.timeId })}
            >
              {isPicked ? '✓ In My Fringe — remove' : '★ Add to My Fringe'}
            </button>
          )}
          {/* These shows need no ticket, so the link is the event page, not a
              call to action -- labelling it "Tickets" contradicts the spec row
              above it. */}
          <a className={styles['detail-panel__tickets']} href={show.ticketUrl} target="_blank" rel="noreferrer">
            {show.freeAdmission ? 'Event page' : 'Tickets'}
          </a>
        </div>
      </div>
    </div>
  );
}
