"use client";

import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "./LanguageProvider";
import styles from "./PhotoViewer.module.css";

type Thumbnail = (index: number, image: ReactNode) => ReactNode;

export function PhotoViewer({ sources, poster = false, children }: {
  sources: string[];
  poster?: boolean;
  children: (thumbnail: Thumbnail) => ReactNode;
}) {
  const { language } = useLanguage();
  const cs = language === "cs";
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const title = poster ? (cs ? "Plakát" : "Poster") : (cs ? "Fotogalerie" : "Photo gallery");
  const selected = index === null ? undefined : sources[index];

  function move(step: number) {
    setIndex(current => ((current ?? 0) + step + sources.length) % sources.length);
  }

  const thumbnail: Thumbnail = (i, image) => (
    <button type="button" className={styles.thumbnail} aria-haspopup="dialog"
      aria-label={poster ? (cs ? "Zvětšit plakát" : "View poster") : (cs ? `Zvětšit fotografii ${i + 1}` : `View photo ${i + 1}`)}
      onClick={e => {
        opener.current = e.currentTarget;
        setIndex(i);
        dialog.current?.showModal();
      }}>
      {image}
    </button>
  );

  return <>
    {children(thumbnail)}
    <dialog ref={dialog} className={styles.viewer} aria-label={title}
      onClose={() => { setIndex(null); opener.current?.focus({ preventScroll: true }); }}
      onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}
      onKeyDown={e => {
        if (sources.length < 2 || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        move(e.key === "ArrowLeft" ? -1 : 1);
      }}>
      <div className={styles.frame}>
        <div className={styles.controls}>
          <span aria-live="polite">{index !== null && `${index + 1} / ${sources.length}`}</span>
          <button type="button" aria-label={cs ? "Zavřít" : "Close"} onClick={() => dialog.current?.close()}>×</button>
        </div>
        {selected && <img className={styles.fullImage} src={selected} referrerPolicy="no-referrer"
          alt={poster ? title : (cs ? `Fotografie ${index! + 1}` : `Photo ${index! + 1}`)}/>}
        {sources.length > 1 && <div className={styles.navigation}>
          <button type="button" aria-label={cs ? "Předchozí fotografie" : "Previous photo"} onClick={() => move(-1)}>←</button>
          <button type="button" aria-label={cs ? "Další fotografie" : "Next photo"} onClick={() => move(1)}>→</button>
        </div>}
      </div>
    </dialog>
  </>;
}

export function PosterViewer({src, children}: {src: string; children: ReactNode}) {
  return <PhotoViewer sources={[src]} poster>{thumbnail => thumbnail(0, children)}</PhotoViewer>;
}
