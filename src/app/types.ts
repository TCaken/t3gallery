import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from '~/server/db/schema';

// Extend the base Lead type from the schema
export interface Lead extends InferSelectModel<typeof leads> {
  latest_appointment?: {
    id?: number;
    start_datetime?: string;
    end_datetime?: string;
    status?: string;
    loan_status?: string;
    loan_notes?: string;
    created_at?: string;
  };
  note?: {
    desc?: string;
  };
  userRole?: string;
} 