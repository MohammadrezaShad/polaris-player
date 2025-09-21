/** src/player/ui/overlays/play-pause-pulse.tsx */
'use client';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause } from 'lucide-react';

import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type PulseKind = 'play' | 'pause';

/** Remount per-pulse using pulseKey to guarantee animation each time */
export function PlayPausePulse({ kind, visible, pulseKey }: { kind: PulseKind; visible: boolean; pulseKey?: number }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={pulseKey ?? 'pulse'}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{
            scale: [0.7, 1.05, 1.25],
            opacity: [0, 1, 0],
            transition: { duration: 0.55, times: [0, 0.35, 1], ease: 'easeOut' },
          }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
            className="rounded-full bg-black/60 p-5 text-white shadow-2xl backdrop-blur"
          >
            {kind === 'play' ? (
              <Play className="h-8 w-8 max-md:h-6 max-md:w-6" />
            ) : (
              <Pause className="h-8 w-8 max-md:h-6 max-sm:w-6" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
