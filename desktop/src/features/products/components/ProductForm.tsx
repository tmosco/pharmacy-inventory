import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RepositoryError } from "../../../data/repositories/productRepository.core";
import { productFormSchema, type ProductFormValues } from "../product.schema";
import "./ProductForm.css";

export interface ProductFormProps {
  onSave: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  initialValues?: ProductFormValues;
  submitLabel?: string;
  // Optional client-side hint only; DB UNIQUE is authoritative.
  existingSkus?: readonly string[];
}

const defaults: ProductFormValues = {
  sku: "", genericName: "", brandName: "", strength: "",
  dosageForm: "", baseUnit: "", reorderLevel: 0,
};

export function ProductForm({
  onSave, onCancel, onPendingChange, onDirtyChange,
  initialValues, submitLabel = "Save product", existingSkus = [],
}: ProductFormProps) {
  const {
    register, handleSubmit, setError, clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues ?? defaults,
    mode: "onSubmit",
  });

  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  async function save(values: ProductFormValues): Promise<void> {
    clearErrors("root");
    if (existingSkus.some((sku) => sku.trim().toLowerCase() === values.sku.trim().toLowerCase())) {
      setError("sku", { type: "manual", message: "This SKU already exists. Use another." }, { shouldFocus: true });
      return;
    }

    try {
      await onSave(values);
      // Do not reset here: parent closes the modal only after successful persistence.
    } catch (error) {
      if (error instanceof RepositoryError && error.code === "DUPLICATE_SKU") {
        setError("sku", { type: "server", message: "This SKU already exists. Use another." }, { shouldFocus: true });
        return;
      }
      if (error instanceof RepositoryError && error.code === "INVALID_INPUT" && error.field) {
        if (error.field in defaults) {
          setError(error.field as keyof ProductFormValues, { type: "server", message: error.message }, { shouldFocus: true });
          return;
        }
      }
      setError("root", {
        type: "server",
        message: error instanceof RepositoryError
          ? error.message
          : "Could not save. Your entries are still here. Try again.",
      });
    }
  }

  return (
    <form className="product-form" noValidate onSubmit={handleSubmit(save)}>
      <p>Required fields are marked *. Details such as purchase prices and expiry are recorded when stock is received.</p>

      <label>SKU *
        <input {...register("sku")} aria-invalid={!!errors.sku} placeholder="PARA-500" autoFocus />
        {errors.sku && <small role="alert">{errors.sku.message}</small>}
      </label>
      <label>Product / generic name *
        <input {...register("genericName")} aria-invalid={!!errors.genericName} placeholder="Paracetamol 500mg" />
        {errors.genericName && <small role="alert">{errors.genericName.message}</small>}
      </label>
      <label>Brand name (optional)
        <input {...register("brandName")} />
      </label>
      <label>Strength (optional)
        <input {...register("strength")} placeholder="500mg" />
      </label>
      <label>Dosage form (optional)
        <input {...register("dosageForm")} placeholder="Tablet" />
      </label>
      <label>Base unit *
        <select {...register("baseUnit")} aria-invalid={!!errors.baseUnit}>
          <option value="">Choose a unit</option>
          <option value="PIECE">Piece</option>
          <option value="TABLET">Tablet</option>
          <option value="KG">Kilogram</option>
          <option value="LITRE">Litre</option>
        </select>
        {errors.baseUnit && <small role="alert">{errors.baseUnit.message}</small>}
      </label>
      <label>Reorder level *
        <input type="number" min="0" step="1"
          {...register("reorderLevel", { valueAsNumber: true })}
          aria-invalid={!!errors.reorderLevel} />
        {errors.reorderLevel && <small role="alert">{errors.reorderLevel.message}</small>}
      </label>

      {errors.root && <p className="product-form__root-error" role="alert">{errors.root.message}</p>}
      <div className="product-form__actions">
        <button type="button" className="product-form__cancel" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
