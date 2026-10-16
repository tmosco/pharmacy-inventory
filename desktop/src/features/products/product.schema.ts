import { z } from 'zod';

export const productFormSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required.'),
  genericName: z.string().trim().min(1, 'Product name is required.'),
  brandName: z.string().trim(),
  strength: z.string().trim(),
  dosageForm: z.string().trim(),
  baseUnit: z.string().trim().min(1, 'Choose a base unit.'),
  reorderLevel: z.number({ error: 'Enter a valid reorder level.' })
    .int('Reorder level must be a whole number.')
    .min(0, 'Reorder level cannot be negative.'),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;
