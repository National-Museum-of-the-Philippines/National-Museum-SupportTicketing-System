import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Avoid aggressive route preload refetch while the user is editing forms.
    defaultPreloadStaleTime: Number.POSITIVE_INFINITY,
    defaultPreload: false,
  });

  return router;
};
