'use client';
export function startOmidSession(videoEl: HTMLVideoElement) {
  try {
    if (!(window as any).omidSessionInterface) return { stop: () => {} };
    // Integrate vendor-specific OMID init here.
    return {
      stop: () => {
        /* end session */
      },
    };
  } catch {
    return { stop: () => {} };
  }
}
