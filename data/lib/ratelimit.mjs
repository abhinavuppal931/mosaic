// Token bucket per provider. `rps` tokens refill per second up to `burst`.
// `now` and `sleep` are injectable so tests run without real waiting.

export function createLimiter({ rps = 5, burst, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const cap = Math.max(1, burst ?? Math.ceil(rps));
  let tokens = cap;
  let last = now();
  let chain = Promise.resolve();

  function refill() {
    const t = now();
    tokens = Math.min(cap, tokens + ((t - last) / 1000) * rps);
    last = t;
  }

  async function takeOne() {
    for (;;) {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(Math.ceil(((1 - tokens) / rps) * 1000));
    }
  }

  return {
    /** Resolves when a request may go out. Calls are served in order. */
    take() {
      const next = chain.then(takeOne);
      chain = next.catch(() => {});
      return next;
    },
    get available() {
      refill();
      return tokens;
    },
  };
}
