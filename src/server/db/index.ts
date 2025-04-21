import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";

import * as schema from "./schema";

// Create the drizzle client with proper query capability
export const db = drizzle(sql, { schema });
 