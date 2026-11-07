"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type Props = {
  email: string | undefined;
  reason: "not_admin" | "clinic_inactive";
  isPlatformAdmin: boolean;
};

export default function NoAccess({ email, reason, isPlatformAdmin }: Props) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const who = email ? <span className="font-medium text-text-primary">{email}</span> : "This account";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border-primary bg-surface-primary p-6 text-center">
        {reason === "clinic_inactive" ? (
          <>
            <h1 className="text-base font-semibold text-text-primary text-balance">This clinic has been deactivated</h1>
            <p className="text-sm text-text-secondary text-pretty">
              {who} belongs to a clinic that is no longer active. Contact HealthHub support to restore access.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-text-primary text-balance">This account isn&apos;t a clinic admin</h1>
            <p className="text-sm text-text-secondary text-pretty">
              {who} is signed in, but isn&apos;t an admin of any clinic.{" "}
              {isPlatformAdmin ? "It's a super admin account — use the platform panel instead." : "Sign out and use your clinic admin account."}
            </p>
          </>
        )}

        <div className="space-y-2">
          {isPlatformAdmin && (
            <Button fullWidth onClick={() => router.push("/platform")}>
              Open platform panel
            </Button>
          )}
          <Button
            fullWidth
            variant={isPlatformAdmin ? "secondary" : undefined}
            onClick={handleSignOut}
            loading={signingOut}
            loadingText="Signing out…"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
