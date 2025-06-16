import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from '~/server/db/schema';

// Extend the base Lead type from the schema
export interface Lead extends InferSelectModel<typeof leads> {
  latest_appointment: any;
  latest_appointment: any;
  userRole?: string;
} 