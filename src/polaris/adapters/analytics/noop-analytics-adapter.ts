/** src/player/adapters/analytics/noop-analytics-adapter.ts */
import type { AnalyticsPort } from '../../ports';

export class NoopAnalyticsAdapter implements AnalyticsPort {
  emit(_event: any, _extras?: Record<string, any>) {
    /* no-op */
  }
  heartbeat?(_metrics: any) {
    /* no-op */
  }
}
