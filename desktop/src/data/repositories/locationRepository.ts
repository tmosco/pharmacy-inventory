import { getDb } from "../db";
import { makeLocationRepository } from "./locationRepository.core";

export const locationRepository = makeLocationRepository(getDb);
export type {
  LocationInput, LocationEdit, LocationRecord, LocationType, ShelfPosition,
} from "./locationRepository.core";
