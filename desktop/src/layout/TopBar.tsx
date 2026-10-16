import { useLocation } from "react-router";
import { navigationItems } from "./navigation";

export function TopBar() {
  const { pathname } = useLocation();
  const page = navigationItems.find((item) => item.path === pathname);
  const title = page?.label ?? "Page not found";

  return (
    <header className="shell-topbar">
      <div className="shell-topbar-heading">
        <span className="shell-eyebrow">Workspace / {title}</span>
        <strong>{title}</strong>
      </div>
      <div className="shell-topbar-account" aria-label="Current workspace">
        <span className="shell-branch">Main Branch · Demo</span>
        <span className="shell-avatar" aria-hidden="true">AD</span>
      </div>
    </header>
  );
}
