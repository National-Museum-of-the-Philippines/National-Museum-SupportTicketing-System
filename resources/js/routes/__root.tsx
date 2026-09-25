import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
} from "@tanstack/react-router";

import { AuthProvider } from "@/lib/auth";
import { LOGIN } from "@/lib/navigation";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="gate-page">
      <div className="gate-page-card">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-maroon">
          Support Ticketing System
        </p>
        <p className="gate-page-code mt-4">404</p>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to={LOGIN}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="gate-page">
      <div className="gate-page-card">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-maroon">
          Support Ticketing System
        </p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Try again
          </button>
          <a
            href={LOGIN}
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-maroon/30 hover:bg-accent hover:shadow-md"
          >
            Log in
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NMP Support Ticketing System" },
      {
        name: "description",
        content: "National Museum of the Philippines Support Ticketing System.",
      },
      { name: "author", content: "National Museum of the Philippines" },
      { property: "og:title", content: "NMP Support Ticketing System" },
      {
        property: "og:description",
        content: "National Museum of the Philippines Support Ticketing System.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
