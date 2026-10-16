import {
  createOptionalNeonHttpDb,
  type NeonHttpDatabase,
} from "@data-projects/shared/db";

import * as schema from "./schema";

export type ClashDatabase = NeonHttpDatabase<typeof schema>;

export const getDb = createOptionalNeonHttpDb(schema);
