// src/player/adapters/utils/hls-sub-cache-loader.ts
// Coalesces in-flight VTT loads and caches responses. Also fakes `stats` on cache hits.
export function buildSubtitleCacheLoader(Hls: any) {
  const BaseLoader = Hls.DefaultConfig.loader;
  const cache = new Map<string, any>();
  const inflight = new Map<string, any[]>();

  const normalize = (url: string) =>
    url
      .split("#")[0]
      .replace(/([?&])_=\d+(&|$)/, "$1") // strip ?_=12345
      .replace(/[?&]hls_[^&=]+=[^&]*/g, ""); // strip hls.js cache-busters

  return class SubtitleCacheLoader extends BaseLoader {
    static __name = "SubtitleCacheLoader"; // for quick console check

    load(context: any, config: any, callbacks: any) {
      const { type, url } = context;
      const key = normalize(url);
      const isText = type === "text" || /\.vtt(\?|$)/i.test(url);

      // Cache hit: return immediately with minimal stats so hls.js won't crash
      if (isText && cache.has(key)) {
        const data = cache.get(key);
        const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        const size = typeof data === "string" ? data.length : data?.byteLength ?? 0;
        const stats = {
          aborted: false,
          retry: 0,
          trequest: now,
          tfirst: now,
          tload: now,
          loaded: size,
          total: size,
        };
        const resp = { url: context.url, data };
        setTimeout(() => callbacks?.onSuccess?.(resp, stats, context, { fromCache: true }), 0);
        return;
      }

      if (isText) {
        // Coalesce concurrent loads for the same VTT URL
        if (inflight.has(key)) {
          inflight.get(key)!.push(callbacks);
          return;
        }
        inflight.set(key, [callbacks]);

        super.load(context, config, {
          onSuccess: (resp: any, stats: any, ctx: any, net: any) => {
            cache.set(key, resp.data);
            const cbs = inflight.get(key)!;
            inflight.delete(key);
            for (const cb of cbs) cb?.onSuccess?.(resp, stats, ctx, net);
          },
          onError: (err: any, ctx: any, net: any) => {
            const cbs = inflight.get(key)!;
            inflight.delete(key);
            for (const cb of cbs) cb?.onError?.(err, ctx, net);
          },
          onTimeout: (stats: any, ctx: any, net: any) => {
            const cbs = inflight.get(key)!;
            inflight.delete(key);
            for (const cb of cbs) cb?.onTimeout?.(stats, ctx, net);
          },
        });
        return;
      }

      // Non-text: passthrough
      super.load(context, config, callbacks);
    }
  };
}
