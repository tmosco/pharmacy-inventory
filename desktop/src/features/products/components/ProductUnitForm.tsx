import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RepositoryError } from "../../../data/repositories/productRepository.core";
import type { NewProductUnit } from "../../../data/repositories/productUnitRepository";
import "./ProductForm.css";

const unitSchema = z.object({
  name: z.string().trim().min(1, "Enter a packaging name."),
  quantityInBaseUnits: z.number({ error: "Enter a conversion quantity." })
    .finite("Enter a finite quantity.").positive("Quantity must be greater than zero."),
  barcode: z.string().trim(),
  packDescription: z.string().trim(),
});
type UnitFormValues = z.infer<typeof unitSchema>;

export interface ProductUnitFormProps {
  productId: string;
  productName: string;
  onSave: (values: NewProductUnit) => Promise<void>;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ProductUnitForm({ productId, productName, onSave, onCancel, onPendingChange, onDirtyChange }: ProductUnitFormProps) {
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting, isDirty } } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: "", quantityInBaseUnits: 1, barcode: "", packDescription: "" },
  });
  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  async function save(values: UnitFormValues) {
    clearErrors("root");
    try {
      await onSave({ ...values, productId });
    } catch (error) {
      if (error instanceof RepositoryError && error.code === "DUPLICATE_BARCODE") {
        setError("barcode", { type:"server", message: "This barcode is already assigned to another unit." }, { shouldFocus: true });
        return;
      }
      setError("root", { type:"server", message: error instanceof RepositoryError ? error.message : "Could not save packaging. Your entries are preserved." });
    }
  }

  return (
    <form className="product-form" noValidate onSubmit={handleSubmit(save)}>
      <p>Packaging for <strong>{productName}</strong>. A box, packet and individual piece can have different barcodes and conversions.</p>
      <label>Packaging name *
        <input {...register("name")} aria-invalid={!!errors.name} placeholder="Box" autoFocus />
        {errors.name && <small role="alert">{errors.name.message}</small>}
      </label>
      <label>Quantity in product base units *
        <input type="number" step="any" {...register("quantityInBaseUnits", { valueAsNumber:true })} aria-invalid={!!errors.quantityInBaseUnits} />
        {errors.quantityInBaseUnits && <small role="alert">{errors.quantityInBaseUnits.message}</small>}
      </label>
      <label>Barcode (optional)
        <input {...register("barcode")} aria-invalid={!!errors.barcode} placeholder="Preserve leading zeros" />
        {errors.barcode && <small role="alert">{errors.barcode.message}</small>}
      </label>
      <label>Pack description (optional)
        <input {...register("packDescription")} placeholder="10 blisters of 10 tablets" />
      </label>
      {errors.root && <p className="product-form__root-error" role="alert">{errors.root.message}</p>}
      <div className="product-form__actions">
        <button type="button" className="product-form__cancel" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save packaging"}</button>
      </div>
    </form>
  );
}
