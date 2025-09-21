import type { AnalyticsPort } from "../../ports";
export class PjAnalyticsAdapter implements AnalyticsPort {
  constructor(private endpoint: string, private common: Record<string, any>) {}
  emit(event: any, extras?: Record<string, any>) {
    const payload = { ...this.common, ...extras, event };
    this.beacon(payload);
  }
  heartbeat(metrics: any) {
    this.beacon({ ...this.common, event: { type: "heartbeat" }, metrics });
  }
  private beacon(body: any) {
    try {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      if (!navigator.sendBeacon(this.endpoint, blob)) {
        fetch(this.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }
}
