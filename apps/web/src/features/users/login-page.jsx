import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../../shared/ui/ThemeToggle/ThemeToggle";
import { login } from "./auth-api.js";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
                alt="JKS — Justification Knowledge Skills"
                className="auth-company-logo-img"
                height={570}
                src="/brand/jks-logo.png"
                width={810}
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
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
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
