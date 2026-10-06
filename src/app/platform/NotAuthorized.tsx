"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export default function NotAuthorized({ email }: { email: string | undefined }) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/platform/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border-primary bg-surface-primary p-6 text-center">
        <h1 className="text-base font-semibold text-text-primary text-balance">This account isn&apos;t a super admin</h1>
        <p className="text-sm text-text-secondary text-pretty">
          {email ? <span className="font-medium text-text-primary">{email}</span> : "This account"} is signed in, but
          doesn&apos;t have access to the platform panel. Sign out and use the super admin account.
        </p>
        <Button fullWidth onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
