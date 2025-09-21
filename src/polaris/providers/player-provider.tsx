/** src/player/providers/player-provider.tsx */
"use client";
import React, { createContext, useContext, useMemo } from "react";

import { EventBus } from "../core/events";
import type { AnalyticsPort, EmbedContext, EnginePort, StoragePort } from "../ports";
import { UniversalEngineAdapter } from "../adapters/engine/universal-adapter";
import { PjAnalyticsAdapter } from "../adapters/analytics/pj-analytics-adapter";
import { createPersistencePlus } from "../adapters/storage/persistence-plus";
import { NoopAnalyticsAdapter } from "../adapters/analytics/noop-analytics-adapter"; // NEW

type Deps = {
  engine: EnginePort;
  storage: StoragePort;
  analytics: AnalyticsPort;
  bus: EventBus;
  embedCtx: EmbedContext;
  playerVersion: string;
};
const PlayerDepsContext = createContext<Deps | null>(null);

export function PlayerProvider({
  children,
  analyticsEndpoint,
  hasAnalytics = true, // NEW
  embedCtx,
  playerVersion = "v2",
}: {
  children: React.ReactNode;
  analyticsEndpoint?: string; // <- make optional to be safe
  hasAnalytics?: boolean; // NEW
  embedCtx: EmbedContext;
  playerVersion?: string;
}) {
  const deps = useMemo<Deps>(
    () => ({
      engine: new UniversalEngineAdapter(),
      storage: createPersistencePlus({
        namespace: "vod",
        version: 1,
        ttlPrefsSec: 365 * 24 * 3600,
        ttlResumeSec: 30 * 24 * 3600,
        consent: () => true,
      }),
      analytics: (hasAnalytics && analyticsEndpoint ? new PjAnalyticsAdapter(analyticsEndpoint, { embedCtx, playerVersion }) : (new NoopAnalyticsAdapter() as unknown)) as AnalyticsPort, // cast to match port
      bus: new EventBus(),
      embedCtx,
      playerVersion,
    }),
    [analyticsEndpoint, embedCtx, playerVersion, hasAnalytics]
  );
  return <PlayerDepsContext.Provider value={deps}>{children}</PlayerDepsContext.Provider>;
}

export const usePlayerDeps = () => {
  const v = useContext(PlayerDepsContext);
  if (!v) throw new Error("usePlayerDeps must be used within <PlayerProvider>");
  return v;
};
