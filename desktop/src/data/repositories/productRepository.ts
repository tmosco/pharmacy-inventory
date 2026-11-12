import { getDb } from "../db";
import { makeProductRepository } from "./productRepository.core";

// The app supplies the actual Tauri SQL connection.
export const productRepository = makeProductRepository(getDb);