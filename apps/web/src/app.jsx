import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">IT</span>
          <span className="brand-name">Hub</span>
        </div>
        <span className="brand-tagline">Internal tooling platform</span>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
