"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiException } from "@/lib/api-client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    let ok = true;
    if (!email.trim()) {
      setEmailError("Email is required");
      ok = false;
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a valid email address");
      ok = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError("Password is required");
      ok = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      ok = false;
    } else {
      setPasswordError(null);
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      // apiClient.login() persists the returned JWT internally on success --
      // nothing further needed here beyond navigating on to the dashboard.
      await apiClient.login({ email: email.trim(), password });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiException) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Could not reach the server. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1">
          <div className="mb-4 flex justify-center">
            <div className="flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-full border-[3px] border-accent shadow-lg">
              <Image
                src="/birdguard-logo.jpg"
                alt="BirdGuard logo"
                width={150}
                height={150}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>

          <h1 className="text-center text-[26px] font-bold text-accent">BirdGuard</h1>
          <p className="mb-8 text-center text-sm text-black/60">
            Sign in to monitor and control your deterrent system
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
              {errorMessage}
            </div>
          )}

          <label className="mb-1 text-sm font-medium text-black/70" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-1 rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-accent"
            placeholder="you@example.com"
          />
          {emailError && <p className="mb-3 text-xs text-red-600">{emailError}</p>}

          <label className="mt-3 mb-1 text-sm font-medium text-black/70" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-1 w-full rounded-xl border border-black/15 px-4 py-3 pr-11 text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {passwordError && <p className="mb-3 text-xs text-red-600">{passwordError}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 flex h-[52px] items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              "Login"
            )}
          </button>

          <div className="mt-5 flex justify-center gap-1.5 text-sm text-black/60">
            <span>Don&apos;t have an account?</span>
            <Link href="/register" className="font-semibold text-accent hover:text-accent-dark">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
