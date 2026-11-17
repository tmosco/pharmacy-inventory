import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { InventoryRepositoryError } from "../../../data/repositories/inventoryRepository.shared";
import type { BranchInput, BranchRecord } from "../../../data/repositories/branchRepository";
import { branchFormSchema, type BranchFormValues } from "../branch.schema";

const defaults: BranchFormValues = {
  code: "",
  name: "",
  street: "",
  city: "",
  region: "",
  country: "",
};

interface BranchFormProps {
  onSave: (values: BranchInput) => Promise<void>;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  initialValues?: BranchRecord;
  existingCodes?: readonly string[];
  submitLabel?: string;
}

export function BranchForm({
  onSave,
  onCancel,
  onPendingChange,
  onDirtyChange,
  initialValues,
  existingCodes = [],
  submitLabel = "Save branch",
}: BranchFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: initialValues
      ? {
          code: initialValues.code,
          name: initialValues.name,
          street: initialValues.street ?? "",
          city: initialValues.city ?? "",
          region: initialValues.region ?? "",
          country: initialValues.country ?? "",
        }
      : defaults,
    mode: "onSubmit",
  });

  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  async function save(values: BranchFormValues): Promise<void> {
    clearErrors("root");
    const normalized = { ...values, code: values.code.trim(), name: values.name.trim() };
    if (existingCodes.some((code) => code.trim().toLowerCase() === normalized.code.toLowerCase())) {
      setError("code", { type: "manual", message: "This branch code already exists. Use another." }, { shouldFocus: true });
      return;
    }

    const input: BranchInput = {
      code: normalized.code,
      name: normalized.name,
      street: normalized.street.trim() || null,
      city: normalized.city.trim() || null,
      region: normalized.region.trim() || null,
      country: normalized.country.trim() || null,
    };

    try {
      await onSave(input);
    } catch (error) {
      if (error instanceof InventoryRepositoryError && error.code === "DUPLICATE_BRANCH_CODE") {
        setError("code", { type: "server", message: "This branch code already exists. Use another." }, { shouldFocus: true });
        return;
      }
      if (error instanceof InventoryRepositoryError && error.code === "INVALID_INPUT" && error.field) {
        if (error.field in defaults) {
          setError(error.field as keyof BranchFormValues, { type: "server", message: error.message }, { shouldFocus: true });
          return;
        }
      }
      setError("root", {
        type: "server",
        message: error instanceof InventoryRepositoryError
          ? error.message
          : "Could not save the branch. Your entries are still here. Try again.",
      });
    }
  }

  return (
    <form className="branch-form" noValidate onSubmit={handleSubmit(save)}>
      <p>Branch code and name are required. Address details are optional.</p>

      <label>
        Branch code *
        <input {...register("code")} placeholder="MAIN" autoComplete="off" aria-invalid={!!errors.code} autoFocus />
        {errors.code && <small role="alert">{errors.code.message}</small>}
      </label>
      <label>
        Branch name *
        <input {...register("name")} placeholder="Main Branch" aria-invalid={!!errors.name} />
        {errors.name && <small role="alert">{errors.name.message}</small>}
      </label>
      <label>
        Street address <span>(optional)</span>
        <input {...register("street")} placeholder="Street or building" aria-invalid={!!errors.street} />
        {errors.street && <small role="alert">{errors.street.message}</small>}
      </label>
      <div className="branch-form__address-grid">
        <label>
          City <span>(optional)</span>
          <input {...register("city")} placeholder="Ikeja" aria-invalid={!!errors.city} />
          {errors.city && <small role="alert">{errors.city.message}</small>}
        </label>
        <label>
          State / region <span>(optional)</span>
          <input {...register("region")} placeholder="Lagos" aria-invalid={!!errors.region} />
          {errors.region && <small role="alert">{errors.region.message}</small>}
        </label>
      </div>
      <label>
        Country <span>(optional)</span>
        <input {...register("country")} placeholder="Nigeria" aria-invalid={!!errors.country} />
        {errors.country && <small role="alert">{errors.country.message}</small>}
      </label>

      {errors.root && <p className="branch-form__root-error" role="alert">{errors.root.message}</p>}
      <div className="branch-form__actions">
        <button type="button" className="branch-form__cancel" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
