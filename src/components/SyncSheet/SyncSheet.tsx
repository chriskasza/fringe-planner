import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useApp } from "../../state/AppContext";
import { pickedList } from "../../lib/derived";
import { encodePicked, parseRestoreInput } from "../../lib/persistence";
import { generateIcs, downloadFile } from "../../lib/ics";
import type { TimeId } from "../../lib/types";
import styles from "./SyncSheet.module.css";

export function SyncSheet() {
  const { state, dispatch, shows } = useApp();
  const picks = pickedList(state.picked, shows);
  const dayCount = new Set(picks.map((e) => e.perf.day)).size;

  if (!state.syncOpen) return null;

  const encoded = encodePicked(state.picked, shows);
  const shareUrl = `${window.location.origin}${window.location.pathname}#p=${encoded}`;

  return (
    <div className={styles["sync-overlay"]}>
      <button
        type="button"
        data-testid="sync-backdrop"
        className={styles["sync-backdrop"]}
        aria-label="Close sync"
        onClick={() => dispatch({ type: "SET_SYNC_OPEN", open: false })}
      />
      <div data-testid="sync-sheet" className={styles["sync-sheet"]} role="dialog" aria-label="Sync My Fringe">
        <div className={styles["sync-sheet__header"]}>
          <div className={styles["sync-sheet__header-left"]}>
            <span className={styles["sync-sheet__title"]}>TAKE IT WITH YOU</span>
            <span className={styles["sync-sheet__summary"]}>
              {state.picked.size} PERFORMANCE{state.picked.size === 1 ? "" : "S"} · {dayCount} DAY{dayCount === 1 ? "" : "S"}
            </span>
          </div>
          <button
            type="button"
            className={styles["sync-sheet__close"]}
            onClick={() => dispatch({ type: "SET_SYNC_OPEN", open: false })}
            aria-label="Close sync"
          >
            ×
          </button>
        </div>

        <div className={styles["sync-sheet__body"]}>
          <div className={styles["sync-link-row"]}>
            <div className={styles["sync-link-row__left"]}>
              <div className={styles["sync-link-row__label-row"]}>
                <span className={styles["sync-link-row__label"]}>YOUR SCHEDULE LINK</span>
                <span className={styles["sync-link-row__badge"]}>
                  <span className={styles["sync-link-row__badge-dot"]} />
                  ALWAYS CURRENT
                </span>
              </div>
              <div data-testid="sync-link-row-url" className={styles["sync-link-row__url"]}>
                {window.location.origin}
                {window.location.pathname}#p=<span className={styles["sync-link-row__hash"]}>{encoded}</span>
              </div>
              <div className={styles["sync-link-row__buttons"]}>
                <CopyButton text={shareUrl} />
                <ShareButton url={shareUrl} />
              </div>
              <span className={styles["sync-link-row__help"]}>
                The address bar rewrites itself every time you pick a show, so this link always matches your schedule. Bookmark it and it doubles as your backup.
              </span>
            </div>
            <div className={styles["sync-link-row__right"]}>
              <QrBlock url={shareUrl} />
              <span className={styles["sync-link-row__qr-label"]}>SCAN PHONE → LAPTOP</span>
            </div>
          </div>

          <div className={styles["sync-divider"]}>
            <span className={styles["sync-divider__line"]} />
            <span className={styles["sync-divider__label"]}>OR</span>
            <span className={styles["sync-divider__line"]} />
          </div>

          <div className={styles["sync-actions"]}>
            <button
              type="button"
              className={`${styles["sync-action-row"]} ${state.picked.size === 0 ? styles["sync-action-row--disabled"] : ""}`}
              disabled={state.picked.size === 0}
              onClick={() => {
                const ics = generateIcs(picks.map((e) => ({ show: e.show, perf: e.perf })));
                downloadFile(ics, "halifax-fringe-2026.ics", "text/calendar;charset=utf-8");
              }}
            >
              <span className={styles["sync-action-row__type"]}>.ICS</span>
              <div className={styles["sync-action-row__info"]}>
                <span className={styles["sync-action-row__title"]}>Add to phone calendar</span>
                <span className={styles["sync-action-row__desc"]}>
                  {state.picked.size} event{state.picked.size === 1 ? "" : "s"} with venue addresses and start times
                </span>
              </div>
            </button>
            <button
              type="button"
              className={`${styles["sync-action-row"]} ${state.picked.size === 0 ? styles["sync-action-row--disabled"] : ""}`}
              disabled={state.picked.size === 0}
              onClick={() => {
                const json = JSON.stringify(
                  picks.map((e) => ({
                    // The stable upstream key, so restoring this file lands
                    // on exactly these performances even if the schedule has
                    // changed since. Everything after it is for the human
                    // reading the file.
                    timeId: e.perf.timeId,
                    title: e.show.title,
                    venue: e.show.venue,
                    address: e.show.venueAddress,
                    day: e.perf.day,
                    start: e.perf.start,
                    mins: e.perf.mins,
                    rating: e.show.rating,
                    ticketUrl: e.show.ticketUrl,
                  })),
                  null,
                  2,
                );
                downloadFile(json, "halifax-fringe-2026.json", "application/json");
              }}
            >
              <span className={styles["sync-action-row__type"]}>.JSON</span>
              <div className={styles["sync-action-row__info"]}>
                <span className={styles["sync-action-row__title"]}>Download a backup file</span>
                <span className={styles["sync-action-row__desc"]}>Keeps working if you clear your browser</span>
              </div>
            </button>
            <RestoreRow onRestore={(picked) => dispatch({ type: "SET_PICKED", picked })} />
          </div>

          <div className={styles["sync-note"]}>
            <span className={styles["sync-note__icon"]}>!</span>
            <span className={styles["sync-note__text"]}>
              A copied link is a snapshot: it carries the picks you had when you copied it, and anyone holding it can see them. Nothing is private, and nothing is stored on a server.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }, [text]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button type="button" className={styles["sync-link-row__copy"]} onClick={copy}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function ShareButton({ url }: { url: string }) {
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.share);
  if (!canShare) return null;

  return (
    <button
      type="button"
      className={styles["sync-link-row__share"]}
      onClick={() => navigator.share({ url }).catch(() => {})}
    >
      Share
    </button>
  );
}

function QrBlock({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    // jsdom has no canvas implementation; the QR code renders as an empty
    // placeholder in tests, which is fine for non-visual assertions.
    try {
      QRCode.toCanvas(canvasRef.current, url, { width: 136, margin: 1, color: { dark: "#F5F1E4", light: "#0B211E" } }).catch(
        () => {},
      );
    } catch {
      // canvas unavailable - tests see the empty element, real browsers work
    }
  }, [url]);

  return <canvas ref={canvasRef} className={styles["sync-qr"]} width={136} height={136} />;
}

function RestoreRow({ onRestore }: { onRestore: (picked: Set<TimeId>) => void }) {
  const { shows } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleRestore(text: string) {
    const picked = parseRestoreInput(text, shows);
    if (picked.size === 0) {
      setMessage("No valid picks found in that link or file.");
      return;
    }
    onRestore(picked);
    setMessage(`Restored ${picked.size} performance${picked.size === 1 ? "" : "s"}.`);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    if (text) handleRestore(text);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") handleRestore(reader.result);
    };
    reader.readAsText(file);
  }

  return (
    // One paste handler for the whole row, on the container: a second one on
    // the input fired for the same event as it bubbled, restoring twice per
    // paste. The pasted text is left in the input rather than swallowed, so
    // it's visible what was read.
    <div
      className={`${styles["sync-action-row"]} ${styles["sync-action-row--restore"]}`}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <span className={styles["sync-action-row__type"]}>↑</span>
      <div className={styles["sync-action-row__info"]}>
        <input
          ref={inputRef}
          className={styles["sync-restore-input"]}
          placeholder="Restore from a link or file"
          aria-label="Restore from a link or file"
          onChange={(e) => {
            // Typed or autofilled rather than pasted - restore on Enter.
            if (!e.target.value) setMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) handleRestore(e.currentTarget.value);
          }}
        />
        <span className={styles["sync-action-row__desc"]}>
          {message ?? "Paste a schedule link, or drop a .json backup here"}
        </span>
      </div>
    </div>
  );
}
