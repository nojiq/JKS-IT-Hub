import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <main className="app-content app-content--login">
        <Outlet />
      </main>
    </div>
  );
}
