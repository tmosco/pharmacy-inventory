import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productFormSchema, type ProductFormValues } from "../product.schema";
import "./ProductForm.css";

interface ProductFormProps {
  onSave: (product: ProductFormValues) => void;
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
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues ?? defaults,
  });

  function save(values: ProductFormValues) {
    if (
      existingSkus.some((sku) => sku.toLowerCase() === values.sku.toLowerCase())
    ) {
      setNotice("");
      setError("sku", { message: "This SKU already exists in this session." });
      return;
    }
    onSave(values);
    setNotice(`Saved ${values.genericName} to temporary memory.`);
    reset(defaults);
  }

  return (
    <form className="product-form" onSubmit={handleSubmit(save)} noValidate>
      <p>Required fields are marked *. This demo does not use a database.</p>
      <label>
        SKU *
        <input
          {...register("sku")}
          aria-invalid={!!errors.sku}
          placeholder="PARA-500"
        />
        {errors.sku && <small role="alert">{errors.sku.message}</small>}
      </label>
      <label>
        Product / generic name *
        <input
          {...register("genericName")}
          aria-invalid={!!errors.genericName}
          placeholder="Paracetamol 500mg"
        />
        {errors.genericName && (
          <small role="alert">{errors.genericName.message}</small>
        )}
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
        {errors.baseUnit && (
          <small role="alert">{errors.baseUnit.message}</small>
        )}
      </label>
      <label>
        Reorder level *
        <input
          type="number"
          step="1"
          {...register("reorderLevel", { valueAsNumber: true })}
          aria-invalid={!!errors.reorderLevel}
        />
        {errors.reorderLevel && (
          <small role="alert">{errors.reorderLevel.message}</small>
        )}
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
