import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { TwoFactorSetup } from "@/lib/api/types";

/** MFA enrollment and management; opened from the sidebar below Settings. */
export function MfaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const statusQuery = useQuery({
    queryKey: ["auth-methods"],
    queryFn: api.authMethods,
    enabled: open,
  });
  const status = statusQuery.data?.twoFactor;

  const onError = (fallback: string) => (err: Error) => {
    toast.error(err instanceof ApiError ? err.message : fallback);
  };

  const requestMutation = useMutation({
    mutationFn: () => api.requestTwoFactor(password),
    onSuccess: (data) => {
      setSetup(data);
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["auth-methods"] });
    },
    onError: onError("Could not start MFA setup"),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmTwoFactor(code.trim()),
    onSuccess: (data) => {
      setSetup(null);
      setCode("");
      queryClient.setQueryData(["auth-methods"], data);
      toast.success("Multi-factor authentication enabled");
    },
    onError: onError("Could not confirm the code"),
  });

  const disableMutation = useMutation({
    mutationFn: () => api.disableTwoFactor(password),
    onSuccess: (data) => {
      setPassword("");
      queryClient.setQueryData(["auth-methods"], data);
      setNewCodes(null);
      toast.success("Multi-factor authentication disabled");
    },
    onError: onError("Could not disable multi-factor authentication"),
  });

  const codesMutation = useMutation({
    mutationFn: () => api.regenerateRecoveryCodes(password),
    onSuccess: ({ recoveryCodes }) => {
      setPassword("");
      setNewCodes(recoveryCodes);
      void queryClient.invalidateQueries({ queryKey: ["auth-methods"] });
      toast.success("New recovery codes generated");
    },
    onError: onError("Could not generate recovery codes"),
  });

  // Closing drops typed secrets; an unconfirmed setup is restarted next time.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassword("");
      setCode("");
      setSetup(null);
      setNewCodes(null);
    }
    onOpenChange(next);
  };

  const passwordField = (
    <div className="space-y-2">
      <Label htmlFor="mfa-password">Current password</Label>
      <Input
        id="mfa-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Multi-factor authentication (MFA)</DialogTitle>
          <DialogDescription>
            Require a code from an authenticator app (Google Authenticator, Microsoft
            Authenticator) in addition to your password when signing in.
          </DialogDescription>
        </DialogHeader>
      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : statusQuery.isError ? (
        <p className="text-sm text-muted-foreground">Could not load MFA status.</p>
      ) : status?.enabled ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            disableMutation.mutate();
          }}
        >
          <p className="text-sm">
            Enabled. {status.recoveryCodesLeft} recovery code
            {status.recoveryCodesLeft === 1 ? "" : "s"} left.
          </p>
          {newCodes ? (
            <div className="space-y-2">
              <Label>New recovery codes</Label>
              <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm leading-relaxed">
                {newCodes.join("  ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Save these now — they are shown only once. Your old codes no longer work.
              </p>
            </div>
          ) : null}
          {passwordField}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!password || codesMutation.isPending}
              onClick={() => codesMutation.mutate()}
            >
              {codesMutation.isPending ? "Generating…" : "New recovery codes"}
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={!password || disableMutation.isPending}
            >
              {disableMutation.isPending ? "Disabling…" : "Disable MFA"}
            </Button>
          </div>
        </form>
      ) : setup ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            confirmMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <div className="mx-auto w-fit rounded-md border bg-white p-3">
              <QRCodeSVG value={setup.otpauthUri} size={168} />
            </div>
            <Label className="block text-center">Scan with your authenticator app</Label>
          </div>
          <div className="space-y-2">
            <Label>Setup key</Label>
            <p className="break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {setup.secret}
            </p>
            <p className="text-xs text-muted-foreground">
              Can't scan? Add an account in the app and enter this key (time-based), or{" "}
              <a className="underline" href={setup.otpauthUri}>
                open it on this device
              </a>
              .
            </p>
          </div>
          <div className="space-y-2">
            <Label>Recovery codes</Label>
            <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm leading-relaxed">
              {setup.recoveryCodes.join("  ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Save these now — they are shown only once. Each works one time if you lose your
              device.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Code from the app</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
            />
          </div>
          <Button type="submit" disabled={!code.trim() || confirmMutation.isPending}>
            {confirmMutation.isPending ? "Confirming…" : "Confirm and enable"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            {status?.pending
              ? "Setup was started but not confirmed. Start again to get a new key."
              : "Not enabled."}
          </p>
          {passwordField}
          <Button type="submit" disabled={!password || requestMutation.isPending}>
            {requestMutation.isPending ? "Starting…" : "Set up MFA"}
          </Button>
        </form>
      )}
      </DialogContent>
    </Dialog>
  );
}
