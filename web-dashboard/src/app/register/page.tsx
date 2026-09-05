"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiClient, ApiException } from "@/lib/api-client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Field = "fullName" | "email" | "username" | "phone" | "password";

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    fullName: "",
    email: "",
    username: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function set(field: Field, v: string) {
    setValues((prev) => ({ ...prev, [field]: v }));
  }

  function validate(): boolean {
    const next: Partial<Record<Field, string>> = {};
    if (!values.fullName.trim()) next.fullName = "Full name is required";
    if (!values.email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(values.email.trim())) next.email = "Enter a valid email address";
    if (!values.username.trim()) next.username = "Username is required";
    if (!values.phone.trim()) next.phone = "Phone number is required";
    if (!values.password) next.password = "Password is required";
    else if (values.password.length < 6) next.password = "Password must be at least 6 characters";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await apiClient.register({
        email: values.email.trim(),
        username: values.username.trim(),
        password: values.password,
        userType: "CUSTOMER",
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
      });
      setSuccessMessage("Account created. You can now log in.");
      // Registration doesn't log the user in automatically -- send them
      // back to the login page (brief pause so the success message is
      // actually visible before navigating away).
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.push("/login");
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

  const fields: { key: Field; label: string; type: string; autoComplete: string }[] = [
    { key: "fullName", label: "Full Name", type: "text", autoComplete: "name" },
    { key: "email", label: "Email", type: "email", autoComplete: "email" },
    { key: "username", label: "Username", type: "text", autoComplete: "username" },
    { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  ];

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
              />
            </div>
          </div>

          <h1 className="text-center text-[26px] font-bold text-accent">Create Account</h1>
          <p className="mb-8 text-center text-sm text-black/60">
            Sign up to start monitoring your BirdGuard system
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-[13px] text-green-700">
              {successMessage}
            </div>
          )}

          {fields.map(({ key, label, type, autoComplete }) => (
            <div key={key} className="mb-3">
              <label className="mb-1 block text-sm font-medium text-black/70" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                type={type}
                autoComplete={autoComplete}
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-accent"
              />
              {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
            </div>
          ))}

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-black/70" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                className="w-full rounded-xl border border-black/15 px-4 py-3 pr-11 text-sm outline-none focus:border-accent"
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
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 flex h-[52px] items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              "Register"
            )}
          </button>

          <div className="mt-5 flex justify-center gap-1.5 text-sm text-black/60">
            <span>Already have an account?</span>
            <button
              type="button"
              onClick={() => router.push("/login")}
              disabled={isLoading}
              className="font-semibold text-accent hover:text-accent-dark"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
