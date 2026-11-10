import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

/**
 * No timed or focus refetching: data never goes stale on its own (staleTime
 * Infinity). It is refetched only after something invalidates it (an action
 * like Approve, or a realtime event). Inactive pages pick that up when opened,
 * so e.g. Request Management shows a just-approved ticket without a reload.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // true = refetch on mount only when stale, i.e. only after an invalidation.
      refetchOnMount: true,
      refetchInterval: false,
      staleTime: Number.POSITIVE_INFINITY,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
