import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  interval: number; // in milliseconds
  enabled?: boolean;
  immediate?: boolean; // whether to run the callback immediately on mount
}

/**
 * Custom hook for polling data at regular intervals
 * @param callback - Function to execute on each poll
 * @param options - Polling configuration
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions
) {
  const { interval, enabled = true, immediate = false } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);
  }, [interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      if (immediate) {
        callbackRef.current();
      }
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling, immediate]);

  return {
    startPolling,
    stopPolling,
    isPolling: intervalRef.current !== null
  };
}
