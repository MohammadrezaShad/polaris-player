/** src/player/ui/overlays/tap-to-unmute.tsx
 * Mobile-only “Tap to unmute” prompt:
 * - Phase A: pill with icon + text (few seconds)
 * - Phase B: compact icon only (persists while muted & playing)
 * - First tap unmutes only (parent should handle `onUnmute`)
 * - Full-surface invisible click-catcher so ANY tap unmutes
 * - Shows a centered loading spinner when `isLoading` is true
 * - Never renders when nothing to show (prevents stray overlay)
 */
'use client';
import * as React from 'react';
import { VolumeX } from 'lucide-react';

import { useI18n, useT } from '../../providers/i18n/i18n';

type TapToUnmuteProps = {
  showPill: boolean;
  showIcon: boolean;
  onUnmute: () => void;
  corner?: 'top-right' | 'top-left';
  isLoading?: boolean;
};

export function TapToUnmute({ showPill, showIcon, onUnmute, corner, isLoading = false }: TapToUnmuteProps) {
  const { dir } = useI18n?.() ?? { dir: 'ltr' as const };
  const t = useT();

  // If nothing to display and not loading, render nothing.
  if (!showPill && !showIcon && !isLoading) return null;

  // Prefer controls.tapToUnmute → overlays.tapToUnmute → default.
  const labelShort = t('controls.tapToUnmute') || t('overlays.tapToUnmute') || 'Tap to unmute';
  const labelLong =
    t('controls.tapToUnmute') || (labelShort && labelShort !== 'Tap to unmute' ? labelShort : 'Tap to unmute sound');

  // Position respects RTL by default unless caller overrides.
  const rtl = dir === 'rtl';
  const place = corner ?? (rtl ? 'top-left' : 'top-right');
  const sideClass = place === 'top-right' ? 'right-0 pr-3' : 'left-0 pl-3';
  const rowDir = place === 'top-right' ? 'flex-row' : 'flex-row-reverse';

  return (
    <div className="absolute inset-0 z-[1100] select-none">
      {/* Full-surface (invisible) catcher: ANY tap unmutes */}
      <button
        type="button"
        aria-label={labelShort}
        className="pointer-events-auto absolute inset-0 bg-transparent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnmute();
        }}
      />

      {/* CENTERED LOADING INDICATOR */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-none rounded-full bg-black/40 p-4 backdrop-blur">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
              role="progressbar"
              aria-valuetext="Buffering"
            />
          </div>
          <span className="sr-only" aria-live="polite">
            {t('overlays.loading')}
          </span>
        </div>
      )}

      {/* Corner affordance (pill → icon) */}
      {(showPill || showIcon) && (
        <div
          className={`pointer-events-none absolute top-3 ${sideClass}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          dir={dir}
        >
          {/* Phase A: pill (text + icon) */}
          {showPill && (
            <button
              type="button"
              className={[
                'pointer-events-auto inline-flex items-center gap-2',
                rowDir,
                'rounded-full bg-black/60 text-white ring-1 ring-white/15 backdrop-blur',
                'px-3 py-1.5 text-xs whitespace-nowrap md:text-sm',
                '[WebkitTapHighlightColor:transparent] cursor-pointer shadow-xl select-none',
                'transition-colors hover:bg-white/15',
              ].join(' ')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnmute();
              }}
              aria-label={labelShort}
              title={labelShort}
            >
              <VolumeX className="h-4 w-4" aria-hidden />
              <span>{labelLong}</span>
            </button>
          )}

          {/* Phase B: compact icon */}
          {!showPill && showIcon && (
            <button
              type="button"
              className={[
                'pointer-events-auto grid place-items-center',
                'h-9 w-9 md:h-10 md:w-10',
                'rounded-full bg-black/60 text-white ring-1 ring-white/15 backdrop-blur',
                '[WebkitTapHighlightColor:transparent] cursor-pointer shadow-lg select-none',
                'transition-colors hover:bg-white/15',
              ].join(' ')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnmute();
              }}
              aria-label={labelShort}
              title={labelShort}
            >
              <VolumeX className="h-4 w-4 md:h-5 md:w-5" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
