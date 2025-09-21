/** src/player/ui/overlays/double-tap-zones.tsx */
'use client';
import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Rewind, FastForward } from 'lucide-react';

import { useT } from '../../providers/i18n/i18n';

export function DoubleTapZones({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const t = useT();
  const lastLeft = React.useRef<number>(0);
  const lastRight = React.useRef<number>(0);
  const THRESH = 280;

  const [flash, setFlash] = React.useState<null | 'left' | 'right'>(null);
  const trigger = (side: 'left' | 'right') => {
    setFlash(side);
    window.setTimeout(() => setFlash(null), 420);
  };

  const handleLeft = () => {
    const now = Date.now();
    if (now - lastLeft.current < THRESH) {
      onLeft();
      trigger('left');
    }
    lastLeft.current = now;
  };
  const handleRight = () => {
    const now = Date.now();
    if (now - lastRight.current < THRESH) {
      onRight();
      trigger('right');
    }
    lastRight.current = now;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none sm:pointer-events-none">
      <button
        aria-label={t('overlays.doubleTapHint')}
        className="pointer-events-auto absolute inset-y-0 left-0 w-1/3 touch-manipulation sm:hidden"
        onClick={handleLeft}
      />
      <button
        className="pointer-events-auto absolute inset-y-0 right-0 w-1/3 touch-manipulation sm:hidden"
        onClick={handleRight}
        aria-label="Double-tap to forward 10 seconds"
      />

      <AnimatePresence>
        {flash === 'left' && (
          <motion.div
            className="absolute top-1/2 left-4 -translate-y-1/2 rounded-2xl bg-black/50 p-3 text-white"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-2">
              <Rewind className="h-6 w-6" />
              <span className="text-sm">-10s</span>
            </div>
          </motion.div>
        )}
        {flash === 'right' && (
          <motion.div
            className="absolute top-1/2 right-4 -translate-y-1/2 rounded-2xl bg-black/50 p-3 text-white"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-2">
              <FastForward className="h-6 w-6" />
              <span className="text-sm">+10s</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
