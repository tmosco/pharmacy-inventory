import type { ProductUnitRecord } from "../../../data/repositories/productUnitRepository";
import "./ProductUnitList.css";

export interface ProductUnitListProps {
  productName: string;
  baseUnit: string;
  units: readonly ProductUnitRecord[];
  loading?: boolean;
  error?: string;
  busy?: boolean;
  onEdit: (unit: ProductUnitRecord) => void;
  onDeactivate: (unit: ProductUnitRecord) => void;
  onRetry: () => void;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export function ProductUnitList({
  productName,
  baseUnit,
  units,
  loading = false,
  error,
  busy = false,
  onEdit,
  onDeactivate,
  onRetry,
}: ProductUnitListProps) {
  return (
    <section className="product-unit-list" aria-label={`Packaging units for ${productName}`}>
      <div className="product-unit-list__heading">
        <div>
          <h3>Packaging for {productName}</h3>
          <p>Each conversion is measured in {baseUnit} base units.</p>
        </div>
        <span>{units.length} {units.length === 1 ? "unit" : "units"}</span>
      </div>

      {loading ? (
        <p className="product-unit-list__message" role="status">Loading packaging from SQLite…</p>
      ) : error ? (
        <div className="product-unit-list__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>Try again</button>
        </div>
      ) : units.length === 0 ? (
        <p className="product-unit-list__message">No packaging units have been added for this product.</p>
      ) : (
        <div className="product-unit-list__scroll">
          <table className="product-unit-list__table">
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Base-unit quantity</th>
                <th scope="col">Barcode</th>
                <th scope="col">Purchase</th>
                <th scope="col">Sale</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td><strong>{unit.name}</strong></td>
                  <td>1 {unit.name} = {formatQuantity(unit.quantityInBaseUnits)} {baseUnit}</td>
                  <td><span className="product-unit-list__barcode">{unit.barcode || "—"}</span></td>
                  <td>{unit.canPurchase ? "Allowed" : "No"}</td>
                  <td>{unit.canSell ? "Allowed" : "No"}</td>
                  <td>{unit.isActive ? "Active" : "Inactive"}{unit.packDescription && <small className="product-unit-list__description">{unit.packDescription}</small>}</td>
                  <td>
                    <button type="button" onClick={() => onEdit(unit)} disabled={busy} aria-label={`Edit ${unit.name} packaging`}>
                      Edit package
                    </button>
                    {unit.isActive && <button type="button" className="product-unit-list__deactivate" onClick={() => onDeactivate(unit)} disabled={busy} aria-label={`Deactivate ${unit.name} packaging`}>Deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
