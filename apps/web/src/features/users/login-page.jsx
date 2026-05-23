import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../../shared/ui/ThemeToggle/ThemeToggle";
import { login } from "./auth-api.js";

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="auth-password-toggle-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="auth-password-toggle-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(["session"], data);
      navigate("/", { replace: true });
    },
    onError: (error) => {
      setErrorMessage(error?.message ?? "Sign-in failed.");
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage("");
    mutation.mutate({ username, password });
  };

  return (
    <div className="login-page">
      <div className="login-page-card-wrap">
        <div className="login-page-toolbar">
          <ThemeToggle />
        </div>
        <section className="auth-card">
          <header className="auth-header">
            <div className="auth-company-logo">
            <img
              alt="IT Hub"
              className="auth-company-logo-img"
              height={1024}
              src="/brand/it-hub-logo.png"
              width={1024}
            />
            </div>
            <h1>IT Hub</h1>
            <p className="auth-subtitle">Sign in using JKS credential</p>
          </header>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Username or email</span>
              <input
                autoComplete="username"
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                required
                type="text"
                value={username}
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password-input">
                <input
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>
            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
            <button className="auth-submit" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
