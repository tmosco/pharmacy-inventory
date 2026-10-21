import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productFormSchema, type ProductFormValues } from "../product.schema";
import "./ProductForm.css";

interface ProductFormProps {
  onSave: (product: ProductFormValues) => Promise<void> | void;
  existingSkus: readonly string[];
  initialValues?: ProductFormValues;
  submitLabel?: string;
}

const defaults: ProductFormValues = {
  sku: "",
  genericName: "",
  brandName: "",
  strength: "",
  dosageForm: "",
  baseUnit: "",
  reorderLevel: 0,
};

export function ProductForm({
  onSave,
  existingSkus,
  initialValues,
  submitLabel = "Save product",
}: ProductFormProps) {
  const [notice, setNotice] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues ?? defaults,
  });

  async function save(values: ProductFormValues) {
    setNotice("");
    clearErrors("root");

    const normalizedSku = values.sku.trim().toLowerCase();
    if (existingSkus.some((sku) => sku.trim().toLowerCase() === normalizedSku)) {
      setError("sku", {
        type: "manual",
        message: "This SKU already exists in this session.",
      });
      return;
    }

    try {
      await onSave(values);
      setNotice(`Saved ${values.genericName}.`);
      // Do not reset: the parent may close the modal after successful saving.
    } catch {
      // Preserve typed values and avoid showing technical details to staff.
      setError("root", {
        type: "server",
        message: "Could not save the product. Your entries are still here; try again.",
      });
    }
  }

  return (
    <form className="product-form" onSubmit={handleSubmit(save)} noValidate>
      <p>Required fields are marked *. Practice data is kept in memory.</p>

      <label>
        SKU *
        <input {...register("sku")} aria-invalid={!!errors.sku} placeholder="PARA-500" />
        {errors.sku && <small role="alert">{errors.sku.message}</small>}
      </label>

      <label>
        Product / generic name *
        <input {...register("genericName")} aria-invalid={!!errors.genericName} placeholder="Paracetamol 500mg" />
        {errors.genericName && <small role="alert">{errors.genericName.message}</small>}
      </label>

      <label>
        Brand name (optional)
        <input {...register("brandName")} />
      </label>

      <label>
        Strength (optional)
        <input {...register("strength")} placeholder="500mg" />
      </label>

      <label>
        Dosage form (optional)
        <input {...register("dosageForm")} placeholder="Tablet" />
      </label>

      <label>
        Base unit *
        <select {...register("baseUnit")} aria-invalid={!!errors.baseUnit}>
          <option value="">Choose a unit</option>
          <option value="PIECE">Piece</option>
          <option value="TABLET">Tablet</option>
          <option value="KG">Kilogram</option>
          <option value="LITRE">Litre</option>
        </select>
        {errors.baseUnit && <small role="alert">{errors.baseUnit.message}</small>}
      </label>

      <label>
        Reorder level *
        <input
          type="number"
          step="1"
          {...register("reorderLevel", { valueAsNumber: true })}
          aria-invalid={!!errors.reorderLevel}
        />
        {errors.reorderLevel && <small role="alert">{errors.reorderLevel.message}</small>}
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </button>

      {errors.root?.message && (
        <p role="alert" className="product-form__submit-error">
          {errors.root.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
