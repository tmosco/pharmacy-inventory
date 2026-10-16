import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-workspace">
        <TopBar />
        <div className="shell-route-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
