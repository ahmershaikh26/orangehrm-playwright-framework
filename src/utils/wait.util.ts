/**
 * Wait for a condition to become truthy by polling.
 * - fn: async function returning boolean (or truthy value)
 * - timeoutMs: maximum wait time (default 10000ms)
 * - intervalMs: polling interval (default 250ms)
 *
 * Returns the last value returned by fn (boolean/truthy) or falsey if timeout reached.
 */
export async function waitForCondition<T = boolean>(
  fn: () => Promise<T | boolean> | Promise<any>,
  timeoutMs = 10_000,
  intervalMs = 250
): Promise<T | boolean> {
  const start = Date.now();
  try {
    let result = await fn();
    while (!result && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs));
      try {
        result = await fn();
      } catch {
        result = false;
      }
    }
    return result;
  } catch {
    // on unexpected error return false
    return false;
  }
}