"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, FormField, Input } from "@/components/ui";

export default function PlatformLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // /platform itself checks the platform_admins table and refuses everyone else.
    router.push("/platform");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">
            HealthHub <span className="font-normal text-text-tertiary">/ Platform</span>
          </p>
          <p className="mt-1 text-sm text-text-secondary">Super admin sign-in</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border-primary bg-surface-primary p-6 shadow-sm"
        >
          {error && <Alert variant="error">{error}</Alert>}

          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormField>

          <FormField label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </FormField>

          <Button type="submit" disabled={loading} fullWidth loading={loading} loadingText="Signing in…">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
