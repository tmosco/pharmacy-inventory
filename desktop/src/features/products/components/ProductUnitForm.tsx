import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InventoryRepositoryError } from "../../../data/repositories/inventoryRepository.shared";
import type { NewProductUnit, ProductUnitRecord } from "../../../data/repositories/productUnitRepository";
import { toBaseUnits } from "../utils/unitConversion";
import "./ProductForm.css";

const unitSchema = z.object({
  name: z.string().trim().min(1, "Enter a packaging name.").max(120, "Use 120 characters or fewer."),
  quantityInBaseUnits: z.number({ error: "Enter a conversion quantity." })
    .int("Conversion must be a positive whole number.").positive("Conversion must be a positive whole number."),
  barcode: z.string().trim().max(100, "Use 100 characters or fewer."),
  packDescription: z.string().trim().max(500, "Use 500 characters or fewer."),
  canPurchase: z.boolean(),
  canSell: z.boolean(),
});
type UnitFormValues = z.infer<typeof unitSchema>;

export interface ProductUnitFormProps {
  productId: string;
  productName: string;
  baseUnit: string;
  onSave: (values: NewProductUnit) => Promise<void>;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  initialValues?: ProductUnitRecord;
  existingNames?: readonly string[];
  existingBarcodes?: readonly string[];
  submitLabel?: string;
}

export function ProductUnitForm({
  productId, productName, baseUnit, onSave, onCancel, onPendingChange, onDirtyChange,
  initialValues, existingNames = [], existingBarcodes = [], submitLabel = "Save packaging",
}: ProductUnitFormProps) {
  const { register, handleSubmit, setError, clearErrors, control, formState: { errors, isSubmitting, isDirty } } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          quantityInBaseUnits: initialValues.quantityInBaseUnits,
          barcode: initialValues.barcode,
          packDescription: initialValues.packDescription,
          canPurchase: initialValues.canPurchase,
          canSell: initialValues.canSell,
        }
      : { name: "", quantityInBaseUnits: 1, barcode: "", packDescription: "", canPurchase: true, canSell: true },
  });
  const [previewQuantity, setPreviewQuantity] = useState("2");
  const factor = useWatch({ control, name: "quantityInBaseUnits" });
  const packageName = useWatch({ control, name: "name" });
  let preview = "";
  try {
    preview = `${previewQuantity} ${packageName?.trim() || "packages"} = ${toBaseUnits(Number(previewQuantity), factor)} ${baseUnit}`;
  } catch (error) {
    preview = error instanceof Error ? error.message : "Enter valid whole numbers to preview.";
  }
  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  async function save(values: UnitFormValues) {
    clearErrors("root");
    if (existingNames.some((name) => name.trim().toLowerCase() === values.name.trim().toLowerCase())) {
      setError("name", { type: "manual", message: "This packaging name already exists for the product." }, { shouldFocus: true });
      return;
    }
    if (values.barcode.trim() && existingBarcodes.some((barcode) => barcode === values.barcode.trim())) {
      setError("barcode", { type: "manual", message: "This barcode is already assigned to another unit." }, { shouldFocus: true });
      return;
    }
    try {
      await onSave({ ...values, productId });
    } catch (error) {
      if (error instanceof InventoryRepositoryError && error.code === "DUPLICATE_BARCODE") {
        setError("barcode", { type:"server", message: "This barcode is already assigned to another unit." }, { shouldFocus: true });
        return;
      }
      if (error instanceof InventoryRepositoryError && error.code === "DUPLICATE_UNIT_NAME") {
        setError("name", { type:"server", message: "This packaging name already exists for the product." }, { shouldFocus: true });
        return;
      }
      if (error instanceof InventoryRepositoryError && error.code === "INVALID_INPUT" && error.field && error.field in unitSchema.shape) {
        setError(error.field as keyof UnitFormValues, { type:"server", message: error.message }, { shouldFocus: true });
        return;
      }
      setError("root", { type:"server", message: error instanceof InventoryRepositoryError ? error.message : "Could not save packaging. Your entries are preserved." });
    }
  }

  return (
    <form className="product-form" noValidate onSubmit={handleSubmit(save)}>
      <p>Packaging for <strong>{productName}</strong>. Enter the quantity in the product’s base unit. Barcode is kept as text so leading zeros are preserved.</p>
      <label>Packaging name *
        <input {...register("name")} aria-invalid={!!errors.name} placeholder="Box" autoFocus />
        {errors.name && <small role="alert">{errors.name.message}</small>}
      </label>
      <label>Base-unit quantity per package *
        <input type="number" min="1" step="1" {...register("quantityInBaseUnits", { valueAsNumber:true })} aria-invalid={!!errors.quantityInBaseUnits} />
        {errors.quantityInBaseUnits && <small role="alert">{errors.quantityInBaseUnits.message}</small>}
      </label>
      <label>Preview package quantity
        <input type="number" min="1" step="1" value={previewQuantity} onChange={(event) => setPreviewQuantity(event.target.value)} />
      </label>
      <p role="status" aria-live="polite">{preview}</p>
      <label>Barcode (optional)
        <input {...register("barcode")} aria-invalid={!!errors.barcode} placeholder="e.g. 001234567890" inputMode="text" />
        {errors.barcode && <small role="alert">{errors.barcode.message}</small>}
      </label>
      <label>Pack description (optional)
        <input {...register("packDescription")} placeholder="10 blisters of 10 tablets" />
      </label>
      <label><input type="checkbox" {...register("canPurchase")} /> Available for purchasing</label>
      <label><input type="checkbox" {...register("canSell")} /> Available for selling</label>
      {errors.root && <p className="product-form__root-error" role="alert">{errors.root.message}</p>}
      <div className="product-form__actions">
        <button type="button" className="product-form__cancel" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
