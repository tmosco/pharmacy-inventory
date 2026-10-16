import { NavLink } from "react-router";
import { navigationItems } from "./navigation";

export function Sidebar() {
  return (
    <aside className="shell-sidebar">
      <div className="shell-brand" aria-label="Stockroom home">
        <div className="shell-brand-mark" aria-hidden="true">S</div>
        <div>
          <strong>Stockroom</strong>
          <small>Inventory workspace</small>
        </div>
      </div>

      <nav className="shell-nav" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              `shell-nav-link${isActive ? " shell-nav-link--active" : ""}`
            }
          >
            <span className="shell-nav-symbol" aria-hidden="true">{item.shortLabel}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="shell-sidebar-footer">
        <span className="shell-connection-dot" aria-hidden="true" />
        UI demo · No live sync
      </div>
    </aside>
  );
}
