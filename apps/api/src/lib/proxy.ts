// Created by Haihs on 12/11/2026
// Optional HTTP proxy for outbound calls (Node's fetch ignores HTTPS_PROXY). Port of server/config/proxy.js; a no-op without a proxy variable.

let configured = false;

/** Returns the proxy URL in use, or null. Safe to call many times (configures once). */
export async function setupProxy(): Promise<string | null> {
  const url =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!url || configured) return url && configured ? url : null;
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent({ uri: url }));
    configured = true;
    return url;
  } catch (err) {
    console.warn(
      `Cannot configure the proxy: ${(err as Error).message}. Calls to the Gemini API may fail.`,
    );
    return null;
  }
}
