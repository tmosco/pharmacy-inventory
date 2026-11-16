import { useCallback, useEffect, useRef, useState } from "react";
import { AppModal } from "../components/AppModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ToastMessage } from "../components/ToastMessage";
import { ProductForm } from "../features/products/components/ProductForm";
import { ProductList } from "../features/products/components/ProductList";
import { ProductUnitForm } from "../features/products/components/ProductUnitForm";
import type { ProductRecord } from "../features/products/product.types";
import type { ProductFormValues } from "../features/products/product.schema";
import { productRepository } from "../data/repositories/productRepository";
import { productUnitRepository, type NewProductUnit } from "../data/repositories/productUnitRepository";
import { RepositoryError } from "../data/repositories/productRepository.core";
import "./Products.css";

type FormMode = "ADD" | "EDIT" | null;
type Notice = { kind: "success" | "error"; message: string };

export function Products() {
  // SQLite is the source of truth. Never seed real catalog IDs from mockProducts.
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [unitProductId, setUnitProductId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalDirty, setModalDirty] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const saveFlight = useRef<Promise<void> | null>(null);
  const unitSaveFlight = useRef<Promise<void> | null>(null);
  const deactivateLock = useRef(false);
  const readVersion = useRef(0);

  // Initial load and explicit Retry/Refresh. Ignore obsolete results.
  useEffect(() => {
    let ignore = false;
    const version = ++readVersion.current;
    setLoading(true);
    setLoadError(null);
    productRepository.list()
      .then((rows) => {
        if (!ignore && version === readVersion.current) {
          setProducts(rows);
          setRefreshError(null);
        }
      })
      .catch((error: unknown) => {
        console.error("Product catalog load failed", error);
        if (!ignore && version === readVersion.current) {
          setLoadError("Could not load products from SQLite. Check the database and try again.");
        }
      })
      .finally(() => {
        if (!ignore && version === readVersion.current) setLoading(false);
      });
    return () => { ignore = true; };
  }, [reloadToken]);

  const selected = products.find((product) => product.id === editingId) ?? null;
  const unitProduct = products.find((product) => product.id === unitProductId) ?? null;
  const deactivationTarget = products.find((product) => product.id === deactivateId) ?? null;
  const actionsBlocked = loading || refreshing || !!loadError || deactivatingId !== null || modalBusy;

  function clearEditor() {
    setFormMode(null);
    setEditingId(null);
    setUnitProductId(null);
    setModalDirty(false);
    setModalBusy(false);
  }

  function requestCloseEditor() {
    if (modalBusy || saveFlight.current || unitSaveFlight.current) return;
    if (modalDirty && !window.confirm("Discard your unsaved changes?")) return;
    clearEditor();
  }

  const updateModalBusy = useCallback((value: boolean) => setModalBusy(value), []);
  const updateModalDirty = useCallback((value: boolean) => setModalDirty(value), []);

  function openAdd() {
    if (actionsBlocked) return;
    clearEditor();
    setNotice(null);
    setFormMode("ADD");
  }

  function openEdit(product: ProductRecord) {
    if (actionsBlocked) return;
    clearEditor();
    setNotice(null);
    setEditingId(product.id);
    setFormMode("EDIT");
  }

  function openPackaging(product: ProductRecord) {
    if (actionsBlocked) return;
    clearEditor();
    setNotice(null);
    setUnitProductId(product.id);
  }

  // Refresh is distinct from the successful write; never repeat the write
  // merely because the follow-up read failed.
  async function refreshAfterMutation() {
    setRefreshing(true);
    setRefreshError(null);
    const version = ++readVersion.current;
    try {
      const fresh = await productRepository.list();
      if (version === readVersion.current) setProducts(fresh);
    } catch (error) {
      console.error("Product catalog refresh failed after confirmed write", error);
      setRefreshError("The change was saved, but the list could not refresh. Use Refresh to retry.");
    } finally {
      setRefreshing(false);
    }
  }

  async function performSave(values: ProductFormValues): Promise<void> {
    const mode = formMode;
    const id = editingId;
    if (mode === "EDIT") {
      if (!id) throw new Error("No product selected for editing.");
      const changed = await productRepository.update(id, values);
      setProducts((current) => current.map((p) => p.id === id ? { ...p, ...changed } : p));
      setNotice({ kind: "success", message: "Product changes saved to SQLite." });
    } else if (mode === "ADD") {
      const saved = await productRepository.create(values);
      setProducts((current) => [...current, saved]);
      setNotice({ kind: "success", message: `${saved.genericName} saved to SQLite.` });
    } else {
      throw new Error("No product form is open.");
    }

    // Only reached after a successful write. Do not keep the modal open
    // merely because a subsequent refresh might fail.
    clearEditor();
    await refreshAfterMutation();
  }

  function saveProduct(values: ProductFormValues): Promise<void> {
    if (saveFlight.current) return saveFlight.current;
    const flight = performSave(values).finally(() => { saveFlight.current = null; });
    saveFlight.current = flight;
    return flight;
  }

  async function performSaveUnit(values: NewProductUnit): Promise<void> {
    await productUnitRepository.create(values);
    const productName = unitProduct?.genericName ?? "Product";
    clearEditor();
    setNotice({ kind: "success", message: `Packaging saved for ${productName}.` });
  }

  function saveUnit(values: NewProductUnit): Promise<void> {
    if (unitSaveFlight.current) return unitSaveFlight.current;
    const flight = performSaveUnit(values).finally(() => { unitSaveFlight.current = null; });
    unitSaveFlight.current = flight;
    return flight;
  }

  function requestDeactivate(product: ProductRecord) {
    if (actionsBlocked || product.status !== "ACTIVE") return;
    setDeactivateId(product.id);
    setNotice(null);
  }

  async function confirmDeactivate() {
    if (!deactivateId || deactivateLock.current) return;
    deactivateLock.current = true;
    const id = deactivateId;
    setDeactivatingId(id);
    try {
      await productRepository.deactivate(id);
      setProducts((current) => current.map((p) => p.id === id ? { ...p, status: "INACTIVE" } : p));
      setDeactivateId(null);
      setNotice({ kind: "success", message: "Product deactivated. Its record was preserved." });
      await refreshAfterMutation();
    } catch (error) {
      console.error("Product deactivation failed", error);
      setNotice({ kind: "error", message: error instanceof RepositoryError ? error.message : "Could not deactivate. Please try again." });
    } finally {
      setDeactivatingId(null);
      deactivateLock.current = false;
    }
  }

  return (
    <main className="sqlite-products-page">
      <header className="sqlite-products-page__heading">
        <div>
          <h1>Products</h1>
          <p>Product catalog saved in SQLite. Purchase-batch inventory is not connected yet.</p>
        </div>
        <div className="sqlite-products-page__toolbar">
          <button type="button" onClick={() => setReloadToken((n) => n + 1)} disabled={actionsBlocked}>Refresh</button>
          <button type="button" className="sqlite-products-page__primary" onClick={openAdd} disabled={actionsBlocked}>Add product</button>
        </div>
      </header>

      {notice && <ToastMessage kind={notice.kind} message={notice.message} onDismiss={() => setNotice(null)} />}
      {refreshError && <div role="alert" className="sqlite-products-page__warning">{refreshError}</div>}
      {loading ? (
        <p role="status">Loading products from SQLite…</p>
      ) : loadError ? (
        <div role="alert" className="sqlite-products-page__error">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadToken((n) => n + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {refreshing && <p role="status">Refreshing product catalog…</p>}
          <ProductList
            products={products}
            onEdit={openEdit}
            onDeactivate={requestDeactivate}
            onAddUnit={openPackaging}
            busyProductId={actionsBlocked ? "busy" : null}
            // Explicitly omit purchaseBatches: those values are not in SQLite yet.
            // The list shows "Not connected" rather than attaching old mock IDs.
          />
        </>
      )}

      {formMode && (
        <AppModal
          title={formMode === "EDIT" ? `Edit ${selected?.genericName ?? "product"}` : "Add product"}
          busy={modalBusy}
          onRequestClose={requestCloseEditor}
        >
          <ProductForm
            key={editingId ?? "add"}
            onSave={saveProduct}
            onCancel={requestCloseEditor}
            onPendingChange={updateModalBusy}
            onDirtyChange={updateModalDirty}
            existingSkus={products.filter((p) => p.id !== editingId).map((p) => p.sku)}
            initialValues={formMode === "EDIT" && selected ? selected : undefined}
            submitLabel={formMode === "EDIT" ? "Save changes" : "Save product"}
          />
        </AppModal>
      )}

      {unitProduct && (
        <AppModal title={`Packaging for ${unitProduct.genericName}`} busy={modalBusy} onRequestClose={requestCloseEditor}>
          <ProductUnitForm
            key={unitProduct.id}
            productId={unitProduct.id}
            productName={unitProduct.genericName}
            onSave={saveUnit}
            onCancel={requestCloseEditor}
            onPendingChange={updateModalBusy}
            onDirtyChange={updateModalDirty}
          />
        </AppModal>
      )}

      {deactivationTarget && (
        <ConfirmDialog
          title={`Deactivate ${deactivationTarget.genericName}?`}
          description="This marks the product inactive. It does not delete its record or purchase history. An authorized reactivation action must be implemented separately."
          confirmLabel="Deactivate product"
          busy={deactivatingId === deactivationTarget.id}
          onCancel={() => { if (!deactivateLock.current) setDeactivateId(null); }}
          onConfirm={confirmDeactivate}
        />
      )}
    </main>
  );
}
