import { Link } from "react-router-dom";

function ChevronIcon() {
  return (
    <svg
      className="assets-entity-link__chevron"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AssetEntityLink({ to, children, kind = "asset", className = "", title }) {
  const kindClass = kind === "user" ? "assets-entity-link--user" : "assets-entity-link--asset";

  return (
    <Link
      to={to}
      className={`assets-entity-link ${kindClass}${className ? ` ${className}` : ""}`}
      title={title}
    >
      <span className="assets-entity-link__label">{children}</span>
      <ChevronIcon />
    </Link>
  );
}
