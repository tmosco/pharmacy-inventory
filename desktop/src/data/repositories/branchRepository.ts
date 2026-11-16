import { getDb } from "../db";
import { makeBranchRepository } from "./branchRepository.core";

export const branchRepository = makeBranchRepository(getDb);
export type { BranchInput, BranchRecord } from "./branchRepository.core";
