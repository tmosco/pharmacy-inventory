import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PurchaseBatchRow } from "./ProductList";
import "./PurchaseBatchEditForm.css";

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

const editSchema = z.object({
  name: z.string().trim().min(1, "Enter a purchase name."),
  sellingPrice: z.number()
    .finite("Enter a valid selling price.")
    .min(0, "Selling price cannot be negative."),
  // Blank means the item has no recorded expiry; validate at the product
  // domain/backend layer whether expiry may actually be omitted.
  expiresAt: z.string().refine(
    value => value === "" || isIsoCalendarDate(value),
    "Enter a valid expiry date.",
  ),
});

export type PurchaseBatchEditValues = z.infer<typeof editSchema>;
export type PurchaseBatchChanges = Pick<PurchaseBatchRow, "name" | "sellingPrice" | "expiresAt">;

export interface PurchaseBatchEditFormProps {
  batch: PurchaseBatchRow;
  productName: string;
  onCancel: () => void;
  onSave: (batchId: string, changes: PurchaseBatchChanges) => void | Promise<void>;
}

/**
 * Edits future price, display name and (corrected) expiry for ONE purchase.
 * Never directly changes original cost, received quantity, or remaining stock.
 */
export function PurchaseBatchEditForm({
  batch,
  productName,
  onCancel,
  onSave,
}: PurchaseBatchEditFormProps) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<PurchaseBatchEditValues>({
      resolver: zodResolver(editSchema),
      defaultValues: {
        name: batch.name,
        sellingPrice: batch.sellingPrice,
        expiresAt: batch.expiresAt ?? "",
      },
    });

  async function submit(values: PurchaseBatchEditValues) {
    try {
      await onSave(batch.id, {
        name: values.name,
        sellingPrice: values.sellingPrice,
        expiresAt: values.expiresAt || null,
      });
    } catch {
      // Keep entered values when the operation fails.
      setError("root", { message: "Unable to save this purchase. Please try again." });
    }
  }

  return (
    <section className="batch-edit" aria-labelledby="batch-edit-title">
      <h2 id="batch-edit-title">Edit {batch.name}</h2>
      <p>Product: <strong>{productName}</strong></p>
      <p className="batch-edit__muted">Original purchase cost and remaining quantity are read-only. Use a separately audited correction or stock adjustment to change them.</p>

      <form noValidate onSubmit={handleSubmit(submit)} className="batch-edit__form">
        <label htmlFor="batch-name">Purchase name</label>
        <input id="batch-name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p role="alert" className="batch-edit__error">{errors.name.message}</p>}

        <label htmlFor="batch-price">Future selling price (per base unit)</label>
        <input id="batch-price" type="number" step="0.01" min="0" {...register("sellingPrice", { valueAsNumber: true })} aria-invalid={!!errors.sellingPrice} />
        {errors.sellingPrice && <p role="alert" className="batch-edit__error">{errors.sellingPrice.message}</p>}

        <label htmlFor="batch-expiry">Expiry date (if applicable)</label>
        <input id="batch-expiry" type="date" {...register("expiresAt")} aria-invalid={!!errors.expiresAt} />
        {errors.expiresAt && <p role="alert" className="batch-edit__error">{errors.expiresAt.message}</p>}

        <dl className="batch-edit__read-only">
          <div><dt>Original cost</dt><dd>{batch.unitCost}</dd></div>
          <div><dt>Remaining stock</dt><dd>{batch.quantityRemaining}</dd></div>
        </dl>

        {errors.root && <p role="alert" className="batch-edit__error">{errors.root.message}</p>}
        <div className="batch-edit__actions">
          <button type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save purchase changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
