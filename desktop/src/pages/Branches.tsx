import { useEffect, useRef, useState } from "react";
import { AppModal } from "../components/AppModal";
import { PageHeader } from "../components/PageHeader";
import { ToastMessage } from "../components/ToastMessage";
import { BranchForm } from "../features/branches/components/BranchForm";
import { BranchList } from "../features/branches/components/BranchList";
import type { BranchInput, BranchRecord } from "../data/repositories/branchRepository";
import { branchRepository } from "../data/repositories/branchRepository";
import "./Branches.css";

type FormMode = "ADD" | "EDIT" | null;
type Notice = { kind: "success" | "error"; message: string };

export function Branches() {
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalDirty, setModalDirty] = useState(false);
  const saveFlight = useRef<Promise<void> | null>(null);
  const readVersion = useRef(0);

  useEffect(() => {
    let ignore = false;
    const version = ++readVersion.current;
    setLoading(true);
    setLoadError(null);
    branchRepository.list()
      .then((rows) => {
        if (!ignore && version === readVersion.current) {
          setBranches(rows);
          setRefreshError(null);
        }
      })
      .catch((error: unknown) => {
        console.error("Branch list load failed", error);
        if (!ignore && version === readVersion.current) {
          setLoadError("Could not load branches from SQLite. Check the database and try again.");
        }
      })
      .finally(() => {
        if (!ignore && version === readVersion.current) setLoading(false);
      });
    return () => { ignore = true; };
  }, [reloadToken]);

  const editingBranch = branches.find((branch) => branch.id === editingId) ?? null;
  const actionsBlocked = loading || refreshing || !!loadError || modalBusy;

  function clearEditor() {
    setFormMode(null);
    setEditingId(null);
    setModalBusy(false);
    setModalDirty(false);
  }

  function requestCloseEditor() {
    if (modalBusy || saveFlight.current) return;
    if (modalDirty && !window.confirm("Discard your unsaved branch changes?")) return;
    clearEditor();
  }

  function openAdd() {
    if (actionsBlocked) return;
    clearEditor();
    setNotice(null);
    setFormMode("ADD");
  }

  function openEdit(branch: BranchRecord) {
    if (actionsBlocked) return;
    clearEditor();
    setNotice(null);
    setEditingId(branch.id);
    setFormMode("EDIT");
  }

  async function refreshAfterMutation() {
    setRefreshing(true);
    setRefreshError(null);
    const version = ++readVersion.current;
    try {
      const fresh = await branchRepository.list();
      if (version === readVersion.current) setBranches(fresh);
    } catch (error) {
      console.error("Branch list refresh failed after confirmed save", error);
      setRefreshError("The branch was saved, but the list could not refresh. Use Refresh to retry.");
    } finally {
      setRefreshing(false);
    }
  }

  async function performSave(values: BranchInput): Promise<void> {
    const mode = formMode;
    const id = editingId;
    if (mode === "EDIT") {
      if (!id) throw new Error("No branch selected for editing.");
      const changed = await branchRepository.update(id, values);
      setBranches((current) => current.map((branch) => branch.id === id ? changed : branch));
      setNotice({ kind: "success", message: "Branch changes saved to SQLite." });
    } else if (mode === "ADD") {
      const saved = await branchRepository.create(values);
      setBranches((current) => [...current, saved]);
      setNotice({ kind: "success", message: `${saved.name} saved to SQLite.` });
    } else {
      throw new Error("No branch form is open.");
    }

    clearEditor();
    await refreshAfterMutation();
  }

  function saveBranch(values: BranchInput): Promise<void> {
    if (saveFlight.current) return saveFlight.current;
    const flight = performSave(values).finally(() => { saveFlight.current = null; });
    saveFlight.current = flight;
    return flight;
  }

  return (
    <main className="sqlite-branches-page">
      <PageHeader
        title="Branches"
        subtitle="Create and manage the outlets that have their own storage locations."
        action={
          <div className="sqlite-branches-page__toolbar">
            <button type="button" onClick={() => setReloadToken((n) => n + 1)} disabled={actionsBlocked}>Refresh</button>
            <button type="button" className="sqlite-branches-page__primary" onClick={openAdd} disabled={actionsBlocked}>Add branch</button>
          </div>
        }
      />

      {notice && <ToastMessage kind={notice.kind} message={notice.message} onDismiss={() => setNotice(null)} />}
      {refreshError && <div role="alert" className="sqlite-branches-page__warning">{refreshError}</div>}

      {loading ? (
        <p role="status">Loading branches from SQLite…</p>
      ) : loadError ? (
        <div role="alert" className="sqlite-branches-page__error">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadToken((n) => n + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {refreshing && <p role="status">Refreshing branch list…</p>}
          <BranchList branches={branches} busy={actionsBlocked} onEdit={openEdit} />
        </>
      )}

      {formMode && (
        <AppModal
          title={formMode === "EDIT" ? `Edit ${editingBranch?.name ?? "branch"}` : "Add branch"}
          busy={modalBusy}
          onRequestClose={requestCloseEditor}
        >
          <BranchForm
            key={editingId ?? "add"}
            onSave={saveBranch}
            onCancel={requestCloseEditor}
            onPendingChange={setModalBusy}
            onDirtyChange={setModalDirty}
            existingCodes={branches.filter((branch) => branch.id !== editingId).map((branch) => branch.code)}
            initialValues={formMode === "EDIT" ? editingBranch ?? undefined : undefined}
            submitLabel={formMode === "EDIT" ? "Save changes" : "Create branch"}
          />
        </AppModal>
      )}

      <p className="sqlite-branches-page__footnote">
        Branch IDs stay the same when you rename an outlet. Locations such as rooms, shelves, and bins belong inside a branch.
      </p>
    </main>
  );
}
