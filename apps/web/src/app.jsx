import { Outlet } from "react-router-dom";
import { ThemeToggle } from "./shared/ui/ThemeToggle/ThemeToggle";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">IT</span>
          <span className="brand-name">Hub</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span className="brand-tagline">Internal tooling platform</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
