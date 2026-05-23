const OPTIONS = [
  { value: "", label: "All" },
  { value: "asset", label: "Asset" },
  { value: "manual", label: "Manual" }
];

export function SourcePillToggle({ value = "", onChange, className = "" }) {
  return (
    <div
      className={`ip-list-source-pills${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label="Filter by source"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          className={`ip-list-source-pill${value === option.value ? " is-active" : ""}`}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
