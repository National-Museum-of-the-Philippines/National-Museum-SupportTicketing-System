import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { NmpLogo } from "@/components/layout/NmpLogo";
import { useAuth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/navigation";
import { useApiHealth } from "@/lib/use-api-health";
import { cn } from "@/lib/utils";
import qualityPolicyBg from "@/assets/nmp-quality-policy.png";

const REMEMBER_KEY = "nmp.support_ticketing.rememberUsername";

export function UnifiedLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiHealth = useApiHealth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      if (!loggedInUser) {
        setError("Incorrect email or password.");
        return;
      }

      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }

      void navigate({ to: dashboardForRole(loggedInUser.role), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <img src={qualityPolicyBg} aria-hidden alt="" className="login-bg-img" />
      <div className="login-vignette" aria-hidden />

      <div className="login-center">
        <div className="flex w-full max-w-104 flex-col gap-5">
          <div className="w-full rounded-[1.25rem] bg-white px-7 py-8 shadow-[0_12px_40px_rgba(60,16,24,0.14)] sm:px-8 sm:py-9">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f8e9eb]">
                <NmpLogo size="sm" className="mx-0 h-11 w-11" />
              </div>
              <h1 className="text-[1.65rem] font-bold tracking-tight text-[#5c121c]">
                Welcome Back
              </h1>
              <p className="mt-1.5 text-[0.92rem] text-slate-500">
                Support Ticketing System — please log in to continue.
              </p>
            </div>

            {apiHealth === "down" ? (
              <div
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                role="alert"
              >
                <p className="font-medium">API server is not running</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  From project root run{" "}
                  <code className="rounded bg-black/10 px-1">bun run start</code> and ensure
                  MongoDB is running.
                </p>
              </div>
            ) : null}

            {apiHealth === "checking" ? (
              <p className="mb-4 text-center text-sm text-slate-500">Checking API connection…</p>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Username
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                      "h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition",
                      "placeholder:text-slate-400 focus:border-[#8b1e2d] focus:ring-2 focus:ring-[#8b1e2d]/20",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                      "h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 outline-none transition",
                      "placeholder:text-slate-400 focus:border-[#8b1e2d] focus:ring-2 focus:ring-[#8b1e2d]/20",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-slate-300 text-[#8b1e2d] accent-[#8b1e2d]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-[#8b1e2d] transition-colors hover:text-[#5c121c]"
                  onClick={() =>
                    setError("Contact your system administrator to reset your password.")
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error ? (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || apiHealth === "down"}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5c121c] text-sm font-semibold text-white shadow-sm transition",
                  "hover:bg-[#4a0e17] disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            </form>

            <div className="relative mt-7">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[#5c121c]">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-[0.78rem] leading-relaxed text-slate-500">
            <p>© 2025 National Museum of the Philippines</p>
            <p className="mt-1">
              <button type="button" className="hover:text-slate-700">
                Privacy Policy
              </button>
              <span className="mx-1.5 text-slate-400">|</span>
              <button type="button" className="hover:text-slate-700">
                Terms of Use
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
