import { createOptionalNeonHttpDb } from "@data-projects/shared/db";
import * as schema from "./schema";

export const getDb = createOptionalNeonHttpDb(schema);
export { schema };
