// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
  pgTable,
  pgEnum,
  pgTableCreator,
} from "drizzle-orm/pg-core";

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
  'assigned',
  'no_answer',
  'follow_up',
  'booked',
  'done',
  'missed/RS',
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

// Define enum for tag types
export const tagTypeEnum = pgEnum('tag_type', [
  'follow_up',
  'no_answer',
  'missed_rs',
  'give_up',
  'blacklisted',
  'done'
]);

// Tags table
export const tags = createTable(
  "tags",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 100 }).notNull().unique(),
    type: d.varchar({ length: 50 }).notNull(),
    description: d.varchar({ length: 255 }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("tag_name_idx").on(t.name),
    index("tag_type_idx").on(t.type)
  ]
);

// Lead Tags junction table
export const leadTags = createTable(
  "lead_tags",
  (d) => ({
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    tag_id: d.integer().references(() => tags.id, { onDelete: "cascade" }).notNull(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    primaryKey({ columns: [t.lead_id, t.tag_id] })
  ]
);

// Leads table
export const leads = createTable(
  "leads",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    phone_number: d.varchar({ length: 20 }).notNull(),
    phone_number_2: d.varchar({ length: 20 }).default(''),
    phone_number_3: d.varchar({ length: 20 }).default(''),
    full_name: d.varchar({ length: 255 }).default(''),
    email: d.varchar({ length: 255 }).default(''),
    residential_status: d.varchar({ length: 50 }).default(''),
    has_work_pass_expiry: d.varchar({ length: 255 }).default(''),
    has_payslip_3months: d.boolean().default(false),
    has_proof_of_residence: d.boolean().default(false),
    proof_of_residence_type: d.varchar({ length: 50 }).default(''),
    has_letter_of_consent: d.boolean().default(false),
    employment_status: d.varchar({ length: 50 }).default(''),
    employment_salary: d.varchar({ length: 50 }).default(''),
    employment_length: d.varchar({ length: 50 }).default(''),
    amount: d.varchar({ length: 50 }).default(''), // Loan Amount
    loan_purpose: d.varchar({ length: 100 }).default(''),
    existing_loans: d.varchar({ length: 50 }).default(''), // Outstanding Loan Amount
    outstanding_loan_amount: d.varchar({ length: 255 }).default(''),
    status: d.varchar({ length: 50 }).default('new').notNull(),
    source: d.varchar({ length: 100 }).default('System'),
    assigned_to: d.varchar({ length: 256 }).default(sql`NULL`),
    lead_type: d.varchar({ length: 50 }).default('new'),
    eligibility_checked: d.boolean().default(false),
    eligibility_status: d.varchar({ length: 50 }).default(''),
    eligibility_notes: d.text().default(''),
    lead_score: d.integer().default(0),
    contact_preference: d.varchar({ length: 50 }).default('No Preferences'),
    communication_language: d.varchar({ length: 50 }).default('No Preferences'),
    follow_up_date: d.timestamp({ withTimezone: true }).default(sql`NULL`),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
    is_contactable: d.boolean().default(false),
    is_deleted: d.boolean().default(false),
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
    primaryKey({ columns: [t.appointment_id, t.timeslot_id] }),
    index("appointment_timeslot_appointment_id_idx").on(t.appointment_id),
    index("appointment_timeslot_timeslot_id_idx").on(t.timeslot_id)
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
    status: d.varchar({ length: 50 }).default('active').notNull(), // Add status field
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

// Add a table for auto-assignment settings
export const autoAssignmentSettings = createTable(
  "auto_assignment_settings",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    is_enabled: d.boolean().default(false),
    assignment_method: d.varchar({ length: 50 }).default('round_robin'), // round_robin, weighted, random
    current_round_robin_index: d.integer().default(0), // Track next agent in rotation
    last_assigned_agent_id: d.varchar({ length: 256 }),
    max_leads_per_agent_per_day: d.integer().default(20),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    updated_by: d.varchar({ length: 256 }),
  }),
  (t) => [
    index("auto_assignment_settings_enabled_idx").on(t.is_enabled)
  ]
);

// Enhanced checked-in agents table with weights and capacity
export const checkedInAgents = createTable(
  "checked_in_agents",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    agent_id: d.varchar({ length: 256 }).references(() => users.id).notNull(),
    checked_in_date: d.date().default(sql`CURRENT_DATE`).notNull(),
    lead_capacity: d.integer().default(10), // Default number of leads an agent can handle
    weight: d.integer().default(1), // Weight for distribution (higher = more leads)
    current_lead_count: d.integer().default(0), // Current leads assigned today
    is_active: d.boolean().default(true),
    last_assigned_at: d.timestamp({ withTimezone: true }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("checked_in_agent_id_idx").on(t.agent_id),
    index("checked_in_date_idx").on(t.checked_in_date),
    index("checked_in_active_idx").on(t.is_active)
  ]
);

// Add assignment history for tracking and analytics
export const leadAssignmentHistory = createTable(
  "lead_assignment_history",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    lead_id: d.integer().references(() => leads.id, { onDelete: "cascade" }).notNull(),
    assigned_to: d.varchar({ length: 256 }).references(() => users.id).notNull(),
    assigned_by: d.varchar({ length: 256 }).references(() => users.id),
    assignment_method: d.varchar({ length: 50 }).notNull(), // auto_round_robin, auto_weighted, manual
    assignment_reason: d.text(), // Why this agent was chosen
    assigned_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    is_active: d.boolean().default(true), // False if lead was reassigned
  }),
  (t) => [
    index("assignment_history_lead_idx").on(t.lead_id),
    index("assignment_history_agent_idx").on(t.assigned_to),
    index("assignment_history_date_idx").on(t.assigned_at)
  ]
);

// WhatsApp Templates table
export const whatsappTemplates = createTable(
  "whatsapp_templates",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    template_id: d.varchar({ length: 100 }).default('WIP'),
    name: d.varchar({ length: 255 }).notNull(),
    description: d.text(),
    workspace_id: d.varchar({ length: 255 }).notNull(),
    channel_id: d.varchar({ length: 255 }).notNull(),
    project_id: d.varchar({ length: 255 }).notNull(),
    is_active: d.boolean().default(true),
    trigger_on_status: d.json(), // Array of lead statuses that trigger this template
    auto_send: d.boolean().default(false), // Whether to auto-send when status changes
    supported_methods: d.json().notNull(), // Array: ['sms', 'whatsapp', 'both']
    default_method: d.varchar({ length: 20 }).default('whatsapp'),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    created_by: d.varchar({ length: 256 }).references(() => users.id),
    updated_by: d.varchar({ length: 256 }).references(() => users.id),
  }),
  (t) => [
    index("whatsapp_template_id_idx").on(t.template_id),
  ]
);

// Template Variables table
export const templateVariables = createTable(
  "template_variables",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    template_id: d.integer().references(() => whatsappTemplates.id, { onDelete: "cascade" }).notNull(),
    variable_key: d.varchar({ length: 100 }).notNull(), // e.g., "Date", "Account_ID"
    variable_type: d.varchar({ length: 50 }).default('string'), // string, number, date
    data_source: d.varchar({ length: 100 }).notNull(), // e.g., "lead.full_name", "user.email", "system.date"
    default_value: d.text(), // Fallback value if data source is null
    format_pattern: d.varchar({ length: 255 }), // For date/number formatting
    is_required: d.boolean().default(true),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("template_var_template_idx").on(t.template_id),
    index("template_var_key_idx").on(t.variable_key)
  ]
);

// Template Usage Log table
export const templateUsageLog = createTable(
  "template_usage_log",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    template_id: d.integer(),
    lead_id: d.integer(), // Made nullable
    sent_to: d.varchar({ length: 20 }).notNull(), // Phone number
    delivery_method: d.varchar({ length: 20 }).notNull(), // sms, whatsapp, both
    status: d.varchar({ length: 50 }).default('pending'), // pending, sent, failed, delivered
    trigger_type: d.varchar({ length: 50 }).notNull(), // manual, auto_status_change, scheduled
    parameters_used: d.json(), // Store the actual parameters sent
    api_response: d.json(), // Store API response for debugging
    error_message: d.text(),
    sent_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    sent_by: d.varchar({ length: 256 }),
  }),
  (t) => [
    index("template_usage_template_idx").on(t.template_id),
    index("template_usage_lead_idx").on(t.lead_id),
    index("template_usage_date_idx").on(t.sent_at)
  ]
);

// Add this new enum for delivery methods
export const deliveryMethodEnum = pgEnum('delivery_method', [
  'sms',
  'whatsapp', 
  'both'
]);

// Add this new enum for template trigger types
export const templateTriggerEnum = pgEnum('template_trigger', [
  'manual',
  'auto_status_change',
  'scheduled',
  'appointment_booked',
  'appointment_reminder'
]);

// Add these relations after all table definitions
export const checkedInAgentsRelations = relations(checkedInAgents, ({ one }) => ({
  agent: one(users, {
    fields: [checkedInAgents.agent_id],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  checkedInAgents: many(checkedInAgents),
  roles: many(userRoles)
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));
