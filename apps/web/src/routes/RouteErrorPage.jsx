import { isRouteErrorResponse, Link, useLocation, useRouteError } from "react-router-dom";
import "./RouteErrorPage.css";

function errorSummary(error) {
  if (isRouteErrorResponse(error)) {
    const detail =
      typeof error.data === "string"
        ? error.data
        : error.data && typeof error.data === "object" && "message" in error.data
          ? String(error.data.message)
          : null;
    return detail || error.statusText || `The server responded with status ${error.status}.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred.";
}

function errorTitle(error) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return "Page not found";
    }
    return `Error ${error.status}`;
  }
  return "Something went wrong";
}

function errorStack(error) {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return null;
}

export function RouteErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const title = errorTitle(error);
  const message = errorSummary(error);
  const stack = import.meta.env.DEV ? errorStack(error) : null;
  const isLoginBranch = location.pathname.startsWith("/login");

  return (
    <div className="route-error-page" role="alert">
      <div className="route-error-page__card">
        <p className="route-error-page__eyebrow">IT Hub</p>
        <h1 className="route-error-page__title">{title}</h1>
        <p className="route-error-page__message">{message}</p>
        {stack ? (
          <pre className="route-error-page__stack" tabIndex={0}>
            {stack}
          </pre>
        ) : null}
        <div className="route-error-page__actions">
          <button type="button" className="route-error-page__btn route-error-page__btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link
            to={isLoginBranch ? "/login" : "/"}
            className="route-error-page__btn route-error-page__btn--secondary"
            replace
          >
            {isLoginBranch ? "Back to sign in" : "Back to dashboard"}
          </Link>
        </div>
      </div>
    </div>
  );
}
