import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`);

export const branchFormSchema = z.object({
  code: z.string().trim().min(1, "Branch code is required.").max(40, "Use 40 characters or fewer."),
  name: z.string().trim().min(1, "Branch name is required.").max(120, "Use 120 characters or fewer."),
  street: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  country: optionalText(120),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
