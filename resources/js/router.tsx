import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";
import { createHashHistory } from '@tanstack/history';

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    history: createHashHistory(),
    context: { queryClient },
    scrollRestoration: true,
    // Avoid aggressive route preload refetch while the user is editing forms.
    defaultPreloadStaleTime: Number.POSITIVE_INFINITY,
    defaultPreload: false,
  });

  return router;
};
