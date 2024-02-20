/* eslint-disable import/prefer-default-export */
export const promiseTimeout = <T>(
  timeoutMs: number,
  promise: Promise<T>,
  error?: Error,
): Promise<T> => {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(error || new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });

  return Promise.race([
    promise.then((res) => {
      // Cancel timeout to prevent open handles
      clearTimeout(timeout);
      return res;
    }),
    timeoutPromise,
  ]) as Promise<T>;
};
