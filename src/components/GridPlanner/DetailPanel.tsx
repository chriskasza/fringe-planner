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
  if (!state.detail) return null;

  const hit = perfIndex(shows).get(state.detail.timeId);
  if (!hit) return null;
  const { show, perf: primaryPerf } = hit;

  const dayLabel = days.find((d) => d.key === primaryPerf.day)?.label ?? primaryPerf.day;
  const pState = perfState(show, primaryPerf, state.picked, shows);
  const isPicked = pState === 'picked' || pState === 'picked-clash';

  const otherPerfs = show.perfs.filter((p) => p.status === 'active' && p.timeId !== primaryPerf.timeId);

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
            {dayLabel} · {formatTime(primaryPerf.start)}–{formatTime(primaryPerf.end)}
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
        </div>

        <p className={styles['detail-panel__blurb']}>{show.blurb}</p>

        {show.warnings.length > 0 && (
          <div className={styles['detail-panel__warnings']}>
            {show.warnings.map((w) => (
              <span key={w} className={styles['detail-panel__warning-chip']}>
                {w}
              </span>
            ))}
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
          <button
            type="button"
            className={`${styles['detail-panel__primary']} ${isPicked ? styles['detail-panel__primary--remove'] : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId: primaryPerf.timeId })}
          >
            {isPicked ? '✓ In My Fringe — remove' : '★ Add to My Fringe'}
          </button>
          <a className={styles['detail-panel__tickets']} href={show.ticketUrl} target="_blank" rel="noreferrer">
            Tickets
          </a>
        </div>
      </div>
    </div>
  );
}
