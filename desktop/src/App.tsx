
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router";

import { AppLayout } from "./layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { FindMedicine } from "./pages/FindMedicine";
import { ModulePage } from "./pages/ModulePage";
import { NotFound } from "./pages/NotFound";
import { Products } from "./pages/Products";

import "./App.css";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />

          <Route
            path="dashboard"
            element={<Navigate to="/" replace />}
          />

          <Route
            path="find-medicine"
            element={<FindMedicine />}
          />

          {/* Actual Products page */}
          <Route
            path="products"
            element={<Products />}
          />

          <Route
            path="locations"
            element={
              <ModulePage
                title="Locations"
                description="Organize shelves, sections, bins, and store rooms."
              />
            }
          />

          <Route
            path="receiving"
            element={
              <ModulePage
                title="Receiving"
                description="Record purchases and independent restock batches."
              />
            }
          />

          <Route
            path="inventory"
            element={
              <ModulePage
                title="Inventory"
                description="View available stock and low-stock alerts."
              />
            }
          />

          <Route
            path="reports"
            element={
              <ModulePage
                title="Reports"
                description="Explore inventory movement, sales, and purchases."
              />
            }
          />

          <Route
            path="sync"
            element={
              <ModulePage
                title="Sync"
                description="A future place for offline and synchronization status."
              />
            }
          />

          <Route
            path="settings"
            element={
              <ModulePage
                title="Settings"
                description="Configure your inventory workspace."
              />
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
