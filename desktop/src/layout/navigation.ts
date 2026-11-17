export interface NavigationItem {
  path: string;
  label: string;
  shortLabel: string;
}

// Single source of truth for sidebar labels and top-bar titles.
export const navigationItems: readonly NavigationItem[] = [
  { path: "/", label: "Dashboard", shortLabel: "DB" },
  { path: "/branches", label: "Branches", shortLabel: "BR" },
  { path: "/find-medicine", label: "Find Medicine", shortLabel: "FM" },
  { path: "/products", label: "Products", shortLabel: "PR" },
  { path: "/locations", label: "Locations", shortLabel: "LO" },
  { path: "/receiving", label: "Receiving", shortLabel: "RC" },
  { path: "/inventory", label: "Inventory", shortLabel: "IN" },
  { path: "/reports", label: "Reports", shortLabel: "RP" },
  { path: "/sync", label: "Sync", shortLabel: "SY" },
  { path: "/settings", label: "Settings", shortLabel: "ST" },
];
