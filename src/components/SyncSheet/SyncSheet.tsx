import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useApp } from "../../state/AppContext";
import { pickedList } from "../../lib/derived";
import { encodePicked, parseRestoreInput } from "../../lib/persistence";
import { generateIcs, downloadFile } from "../../lib/ics";
import type { PerfKey } from "../../lib/types";
import "./SyncSheet.css";

export function SyncSheet() {
  const { state, dispatch, shows } = useApp();
  const picks = pickedList(state.picked, shows);
  const dayCount = new Set(picks.map((e) => e.perf.day)).size;

  if (!state.syncOpen) return null;

  const encoded = encodePicked(state.picked, shows);
  const shareUrl = `${window.location.origin}${window.location.pathname}#p=${encoded}`;

  return (
    <div className="sync-overlay">
      <button
        type="button"
        className="sync-backdrop"
        aria-label="Close sync"
        onClick={() => dispatch({ type: "SET_SYNC_OPEN", open: false })}
      />
      <div className="sync-sheet" role="dialog" aria-label="Sync My Fringe">
        <div className="sync-sheet__header">
          <div className="sync-sheet__header-left">
            <span className="sync-sheet__title">TAKE IT WITH YOU</span>
            <span className="sync-sheet__summary">
              {state.picked.size} PERFORMANCE{state.picked.size === 1 ? "" : "S"} · {dayCount} DAY{dayCount === 1 ? "" : "S"}
            </span>
          </div>
          <button
            type="button"
            className="sync-sheet__close"
            onClick={() => dispatch({ type: "SET_SYNC_OPEN", open: false })}
            aria-label="Close sync"
          >
            ×
          </button>
        </div>

        <div className="sync-sheet__body">
          <div className="sync-link-row">
            <div className="sync-link-row__left">
              <div className="sync-link-row__label-row">
                <span className="sync-link-row__label">YOUR SCHEDULE LINK</span>
                <span className="sync-link-row__badge">
                  <span className="sync-link-row__badge-dot" />
                  ALWAYS CURRENT
                </span>
              </div>
              <div className="sync-link-row__url">
                {window.location.origin}{window.location.pathname}#p=<span className="sync-link-row__hash">{encoded}</span>
              </div>
              <div className="sync-link-row__buttons">
                <CopyButton text={shareUrl} />
                <ShareButton url={shareUrl} />
              </div>
              <span className="sync-link-row__help">
                The address bar rewrites itself every time you pick a show, so this link always matches your schedule. Bookmark it and it doubles as your backup.
              </span>
            </div>
            <div className="sync-link-row__right">
              <QrBlock url={shareUrl} />
              <span className="sync-link-row__qr-label">SCAN PHONE → LAPTOP</span>
            </div>
          </div>

          <div className="sync-divider">
            <span className="sync-divider__line" />
            <span className="sync-divider__label">OR</span>
            <span className="sync-divider__line" />
          </div>

          <div className="sync-actions">
            <button
              type="button"
              className="sync-action-row"
              onClick={() => {
                const ics = generateIcs(picks.map((e) => ({ show: e.show, perf: e.perf })));
                downloadFile(ics, "halifax-fringe-2026.ics", "text/calendar;charset=utf-8");
              }}
            >
              <span className="sync-action-row__type">.ICS</span>
              <div className="sync-action-row__info">
                <span className="sync-action-row__title">Add to phone calendar</span>
                <span className="sync-action-row__desc">
                  {state.picked.size} event{state.picked.size === 1 ? "" : "s"} with venue addresses and start times
                </span>
              </div>
            </button>
            <button
              type="button"
              className="sync-action-row"
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
              <span className="sync-action-row__type">.JSON</span>
              <div className="sync-action-row__info">
                <span className="sync-action-row__title">Download a backup file</span>
                <span className="sync-action-row__desc">Keeps working if you clear your browser</span>
              </div>
            </button>
            <RestoreRow onRestore={(picked) => dispatch({ type: "SET_PICKED", picked })} />
          </div>

          <div className="sync-note">
            <span className="sync-note__icon">!</span>
            <span className="sync-note__text">
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
    <button type="button" className="sync-link-row__copy" onClick={copy}>
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
      className="sync-link-row__share"
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

  return <canvas ref={canvasRef} className="sync-qr" width={136} height={136} />;
}

function RestoreRow({ onRestore }: { onRestore: (picked: Set<PerfKey>) => void }) {
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
      className="sync-action-row sync-action-row--restore"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <span className="sync-action-row__type">↑</span>
      <div className="sync-action-row__info">
        <input
          ref={inputRef}
          className="sync-restore-input"
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
        <span className="sync-action-row__desc">
          {message ?? "Paste a schedule link, or drop a .json backup here"}
        </span>
      </div>
    </div>
  );
}
