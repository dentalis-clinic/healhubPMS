"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import Image from "next/image";
import { Button, Input, FormField, Alert } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_callback_failed"
      ? "Authentication failed. Please try again."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="DentalisPMS Logo" width={180} height={50} className="h-12 w-auto" priority />
          </div>
          <p className="mt-1 text-body-sm text-text-hint">
            Admin sign-in
          </p>
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
              placeholder="admin@example.com"
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
              placeholder="••••••••"
            />
          </FormField>

          <Button type="submit" disabled={loading} fullWidth loading={loading} loadingText="Signing in…">
            Sign in
          </Button>
        </form>

        <p className="text-center text-xs text-text-tertiary">
          New clinic?{" "}
          <a href="/register" className="text-text-link hover:underline">
            Register here
          </a>
        </p>
      </div>
    </div>
  );
}
