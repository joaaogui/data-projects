import { createLazyNeonHttpDb } from "@data-projects/shared/db";
import * as schema from "./schema";

export const db = createLazyNeonHttpDb(schema);
