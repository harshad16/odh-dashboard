import * as React from 'react';
import { K8sAPIOptions } from '~/k8sTypes';

/**
 * Allows "I'm not ready" rejections if you lack a lazy provided prop
 * e.g. Promise.reject(new NotReadyError('Do not have namespace'))
 */
export class NotReadyError extends Error {
  constructor(reason: string) {
    super(`Not ready yet. ${reason}`);
    this.name = 'NotReadyError';
  }
}

/**
 * Checks to see if it's a standard error handled by useStateFetch .catch block.
 */
export const isCommonStateError = (e: Error) => {
  if (e.name === 'NotReadyError') {
    // An escape hatch for callers to reject the call at this fetchCallbackPromise reference
    // Re-compute your callback to re-trigger again
    return true;
  }
  if (e.name == 'AbortError') {
    // Abort errors are silent
    return true;
  }

  return false;
};

/** Provided as a promise, so you can await a refresh before enabling buttons / closing modals.
 * Returns the successful value or nothing if the call was cancelled / didn't complete. */
export type FetchStateRefreshPromise<Type> = () => Promise<Type | undefined>;

/** Return state */
export type FetchState<Type, Default extends Type = Type> = [
  data: Type | Default,
  loaded: boolean,
  loadError: Error | undefined,
  /** This promise should never throw to the .catch */
  refresh: FetchStateRefreshPromise<Type>,
];

type SetStateLazy<Type> = (lastState: Type) => Type;
export type AdHocUpdate<Type> = (updateLater: (updater: SetStateLazy<Type>) => void) => void;

/**
 * All callbacks will receive a K8sAPIOptions, which includes a signal to provide to a RequestInit.
 * This will allow the call to be cancelled if the hook needs to unload. It is recommended that you
 * upgrade your API handlers to support this.
 */
type FetchStateCallbackPromiseReturn<Return> = (opts: K8sAPIOptions) => Return;

/**
 * Standard usage. Your callback should return a Promise that resolves to your data.
 */
export type FetchStateCallbackPromise<Type> = FetchStateCallbackPromiseReturn<Promise<Type>>;

/**
 * Advanced usage. If you have a need to include a lazy refresh state to your data, you can use this
 * functionality. It works on the lazy React.setState functionality.
 *
 * Note: When using, you're giving up immediate setState, so you'll want to call the setStateLater
 * function immediately to get back that functionality.
 *
 * Example:
 * ```
 * React.useCallback(() =>
 *   new Promise(() => {
 *     MyAPICall().then((...) =>
 *       resolve((setStateLater) => { // << providing a function instead of the value
 *         setStateLater({ ...someInitialData })
 *         // ...some time later, after more calls / in a callback / etc
 *         setStateLater((lastState) => ({ ...lastState, data: additionalData }))
 *       })
 *     )
 *   })
 * );
 * ```
 */
export type FetchStateCallbackPromiseAdHoc<Type> = FetchStateCallbackPromiseReturn<
  Promise<AdHocUpdate<Type>>
>;

type FetchOptions = {
  /** To enable auto refresh */
  refreshRate: number;
  /**
   * Makes your promise pure from the sense of if it changes you do not want the previous data. When
   * you recompute your fetchCallbackPromise, do you want to drop the values stored? This will
   * reset everything; result, loaded, & error state. Intended purpose is if your promise is keyed
   * off of a value that if it changes you should drop all data as it's fundamentally a different
   * thing - sharing old state is misleading.
   *
   * Note: Doing this could have undesired side effects. Consider your hook's dependents and the
   * state of your data.
   * Note: This is only read as initial value; changes do nothing.
   */
  initialPromisePurity: boolean;
};

/**
 * A boilerplate helper utility. Given a callback that returns a promise, it will store state and
 * handle refreshes on intervals as needed.
 *
 * Note: Your callback *should* support the opts property so the call can be cancelled.
 */
const useFetchState = <Type, Default extends Type = Type>(
  /** React.useCallback result. */
  fetchCallbackPromise: FetchStateCallbackPromise<Type> | FetchStateCallbackPromiseAdHoc<Type>,
  /**
   * A preferred default states - this is ignored after the first render
   * Note: This is only read as initial value; changes do nothing.
   */
  initialDefaultState: Default,
  /** Configurable features */
  { refreshRate = 0, initialPromisePurity = false }: Partial<FetchOptions> = {},
): FetchState<Type, Default> => {
  const [result, setResult] = React.useState<Type | Default>(initialDefaultState);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<Error | undefined>(undefined);
  const abortCallbackRef = React.useRef<() => void>(() => undefined);
  /** Setup on initial hook a singular reset function. DefaultState & resetDataOnNewPromise are initial render states. */
  const cleanupRef = React.useRef(() => {
    if (initialPromisePurity) {
      setResult(initialDefaultState);
      setLoaded(false);
      setLoadError(undefined);
    }
  });

  React.useEffect(() => {
    cleanupRef.current();
  }, [fetchCallbackPromise]);

  const call = React.useCallback<() => [Promise<Type>, () => void]>(() => {
    let alreadyAborted = false;
    const abortController = new AbortController();

    /** Note: this promise cannot "catch" beyond this instance -- unless a runtime error. */
    const doRequest = () =>
      fetchCallbackPromise({ signal: abortController.signal })
        .then((r) => {
          if (alreadyAborted) {
            return;
          }

          if (r === undefined) {
            // Undefined is an unacceptable response. If you want "nothing", pass `null` -- this is likely an API issue though.
            // eslint-disable-next-line no-console
            console.error(
              'useFetchState Error: Got undefined back from a promise. This is likely an error with your call. Preventing setting.',
            );
            return;
          }

          setLoadError(undefined);
          if (typeof r === 'function') {
            r((setState: SetStateLazy<Type>) => {
              if (alreadyAborted) {
                return;
              }

              setResult(setState);
              setLoaded(true);
            });
            return undefined;
          }

          setResult(r);
          setLoaded(true);

          return r;
        })
        .catch((e) => {
          if (alreadyAborted) {
            return;
          }

          if (isCommonStateError(e)) {
            return;
          }
          setLoadError(e);
        });

    const unload = () => {
      if (alreadyAborted) {
        return;
      }

      alreadyAborted = true;
      abortController.abort();
    };

    return [doRequest(), unload];
  }, [fetchCallbackPromise]);

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const callAndSave = () => {
      const [, unload] = call();
      abortCallbackRef.current = unload;
    };
    callAndSave();

    if (refreshRate > 0) {
      interval = setInterval(() => {
        abortCallbackRef.current();
        callAndSave();
      }, refreshRate);
    }

    return () => {
      clearInterval(interval);
      abortCallbackRef.current();
    };
  }, [call, refreshRate]);

  const refresh = React.useCallback<FetchStateRefreshPromise<Type>>(() => {
    abortCallbackRef.current();
    const [callPromise, unload] = call();
    abortCallbackRef.current = unload;
    return callPromise;
  }, [call]);

  return [result, loaded, loadError, refresh];
};

export default useFetchState;
