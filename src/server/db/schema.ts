// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey, varchar, timestamp, integer, text, boolean, pgEnum} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `t3gallery_${name}`);

// Images table
export const images = createTable(
  "images",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }).notNull(),
    url: d.varchar({ length: 1024 }).notNull(),
    userId: d.varchar({ length: 256 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);

// Permissions table
export const permissions = createTable(
  "permissions",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 100 }).notNull().unique(),
    description: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("permission_name_idx").on(t.name)],
);

// Roles table
export const roles = createTable(
  "roles",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 100 }).notNull().unique(),
    description: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("role_name_idx").on(t.name)],
);

// Role_Permissions junction table
export const rolePermissions = createTable(
  "role_permissions",
  (d) => ({
    roleId: d.integer().references(() => roles.id, { onDelete: "cascade" }).notNull(),
    permissionId: d.integer().references(() => permissions.id, { onDelete: "cascade" }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] })
  ],
);

// User_Roles junction table that maps Clerk user IDs to roles
export const userRoles = createTable(
  "user_roles",
  (d) => ({
    userId: d.varchar({ length: 256 }).notNull(),
    roleId: d.integer().references(() => roles.id, { onDelete: "cascade" }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] })
  ],
);

// Define enum for lead statuses
export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'open',
  'contacted',
  'no_answer',
  'follow_up',
  'booked',
  'unqualified',
  'give_up',
  'blacklisted'
]);

// Define enum for appointment statuses
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'upcoming',
  'cancelled',
  'done',
  'missed'
]);

// Define enum for action types
export const actionTypeEnum = pgEnum('action_type', [
  'call',
  'whatsapp',
  'note',
  'assigned',
  'others'
]);

// Define enum for lead types
export const leadTypeEnum = pgEnum('lead_type', [
  'new',
  'reloan'
]);

// Define enum for lead card actions
export const leadCardActionEnum = pgEnum('lead_card_action', [
  'view',
  'add_note',
  'schedule_appointment',
  'make_call',
  'send_message',
  'change_status',
  'assign_lead',
  'delete_lead',
  'edit_lead',
  'pin_lead'
]);

// Leads table
export const leads = createTable(
  "leads",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    phone_number: d.varchar({ length: 20 }).notNull(),
    first_name: d.varchar({ length: 255 }),
    last_name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }),
    status: d.varchar({ length: 50 }).default('new').notNull(),
    source: d.varchar({ length: 100 }),
    assigned_to: d.varchar({ length: 256 }).references(() => users.id),
    lead_type: d.varchar({ length: 50 }).default('acquisition'),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    index("lead_phone_idx").on(t.phone_number),
    index("lead_email_idx").on(t.email),
    index("lead_status_idx").on(t.status),
    index("lead_assigned_to_idx").on(t.assigned_to)
  ]
);

// Lead Actions table
export const lead_actions = createTable(
  "lead_actions",
  (d) => ({
    action_id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    user_id: d.varchar({ length: 256 }).references(() => users.id).notNull(),
    action_type: d.varchar({ length: 50 }).notNull(),
    content: d.text(),
    timestamp: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    index("lead_action_lead_id_idx").on(t.lead_id)
  ]
);

// Pinned Leads table
export const pinned_leads = createTable(
  "pinned_leads", 
  (d) => ({
    user_id: d.varchar({ length: 256 }).references(() => users.id).notNull(),
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    pinned_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    reason: d.text(),
    primary: d.boolean().default(false),
  }),
  (t) => [
    primaryKey({ columns: [t.user_id, t.lead_id] })
  ]
);

// Appointments table
export const appointments = createTable(
  "appointments",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    agent_id: d.varchar({ length: 256 }).references(() => users.id).notNull(),
    status: d.varchar({ length: 50 }).default('upcoming').notNull(),
    notes: d.text(),
    start_datetime: d.timestamp({ withTimezone: true }).notNull(),
    end_datetime: d.timestamp({ withTimezone: true }).notNull(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    index("appointment_lead_id_idx").on(t.lead_id),
    index("appointment_agent_id_idx").on(t.agent_id),
    index("appointment_status_idx").on(t.status)
  ]
);

// Timeslots table
export const timeslots = createTable(
  "timeslots",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    date: d.date().notNull(),
    start_time: d.time().notNull(),
    end_time: d.time().notNull(),
    max_capacity: d.integer().default(1),
    occupied_count: d.integer().default(0),
    calendar_setting_id: d.integer().references(() => calendar_settings.id),
    is_disabled: d.boolean().default(false),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  })
);

// Appointment Timeslots junction table
export const appointment_timeslots = createTable(
  "appointment_timeslots",
  (d) => ({
    appointment_id: d.integer().references(() => appointments.id, { onDelete: "cascade" }).notNull(),
    timeslot_id: d.integer().references(() => timeslots.id, { onDelete: "cascade" }).notNull(),
    primary: d.boolean().default(true),
  }),
  (t) => [
    primaryKey({ columns: [t.appointment_id, t.timeslot_id] })
  ]
);

// Calendar Settings table
export const calendar_settings = createTable(
  "calendar_settings",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 100 }).notNull(),
    working_days: d.json(),
    daily_start_time: d.time(),
    daily_end_time: d.time(),
    slot_duration_minutes: d.integer(),
    default_max_capacity: d.integer().default(1),
    timezone: d.varchar({ length: 50 }).default('UTC'),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  })
);

// Calendar Exceptions table
export const calendar_exceptions = createTable(
  "calendar_exceptions",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    date: d.date().notNull(),
    is_closed: d.boolean().default(false),
    reason: d.text(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  })
);

// Lead Notes table
export const lead_notes = createTable(
  "lead_notes",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    content: d.text().notNull(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    index("lead_notes_lead_id_idx").on(t.lead_id)
  ]
);

// Make sure your user schema is compatible with Clerk
export const users = createTable(
  "users",
  (d) => ({
    id: d.varchar({ length: 256 }).primaryKey(), // Use Clerk user ID
    first_name: d.varchar({ length: 255 }),
    last_name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }),
    password_hash: d.text(),
    role: d.varchar({ length: 50 }).default('user'),
    team: d.varchar({ length: 100 }),
    is_verified: d.boolean().default(false),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }),
    updated_by: d.varchar({ length: 256 }),
  }),
  (t) => [
    index("user_email_idx").on(t.email)
  ]
);

// Log table for auditing
export const logs = createTable(
  "logs",
  (d) => ({
    log_id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    description: d.text(),
    entity_type: d.varchar({ length: 100 }).notNull(),
    entity_id: d.varchar({ length: 256 }).notNull(),
    action: d.varchar({ length: 50 }).notNull(),
    performed_by: d.varchar({ length: 256 }).references(() => users.id),
    timestamp: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  })
);

// Report Snapshots table
export const report_snapshots = createTable(
  "report_snapshots",
  (d) => ({
    report_id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    report_date: d.date().notNull(),
    type: d.varchar({ length: 100 }).notNull(),
    data: d.json(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  })
);
