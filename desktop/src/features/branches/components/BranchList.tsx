import type { BranchRecord } from "../../../data/repositories/branchRepository";

interface BranchListProps {
  branches: readonly BranchRecord[];
  busy: boolean;
  onEdit: (branch: BranchRecord) => void;
}

export function BranchList({ branches, busy, onEdit }: BranchListProps) {
  if (branches.length === 0) {
    return (
      <div className="branch-list__empty">
        <div className="branch-list__empty-mark" aria-hidden="true">BR</div>
        <h2>No branches yet</h2>
        <p>Create the first outlet. For a single pharmacy, you can start with MAIN / Main Branch.</p>
      </div>
    );
  }

  return (
    <ul className="branch-list">
      {branches.map((branch) => {
        const address = [branch.street, branch.city, branch.region, branch.country]
          .filter((part): part is string => Boolean(part))
          .join(", ");
        return (
          <li className="branch-list__row" key={branch.id}>
            <div className="branch-list__identity">
              <span className="branch-list__code">{branch.code}</span>
              <div className="branch-list__copy">
                <strong>{branch.name}</strong>
                <span>{address || "No address added"}</span>
              </div>
            </div>
            <button type="button" onClick={() => onEdit(branch)} disabled={busy} aria-label={`Edit ${branch.name}`}>
              Edit
            </button>
          </li>
        );
      })}
    </ul>
  );
}
