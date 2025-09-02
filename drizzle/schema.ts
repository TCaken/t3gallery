import { pgTable, integer, date, boolean, text, timestamp, index, foreignKey, varchar, json, time, unique, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const aaStatus = pgEnum("aa_status", ['yes', 'no', 'pending'])
export const actionType = pgEnum("action_type", ['call', 'whatsapp', 'note', 'assigned', 'others'])
export const appointmentStatus = pgEnum("appointment_status", ['upcoming', 'cancelled', 'done', 'missed'])
export const borrowerStatus = pgEnum("borrower_status", ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'done', 'missed/RS', 'unqualified', 'give_up', 'blacklisted'])
export const customerRating = pgEnum("customer_rating", ['excellent', 'very_good', 'good', 'fair', 'poor'])
export const deliveryMethod = pgEnum("delivery_method", ['sms', 'whatsapp', 'both'])
export const financialCommitmentChange = pgEnum("financial_commitment_change", ['increased', 'decreased', 'same', 'not_applicable'])
export const idType = pgEnum("id_type", ['singapore_nric', 'singapore_pr', 'fin'])
export const incomeDocumentType = pgEnum("income_document_type", ['bank_statement', 'noa', 'cpf'])
export const leadCardAction = pgEnum("lead_card_action", ['view', 'add_note', 'schedule_appointment', 'make_call', 'send_message', 'change_status', 'assign_lead', 'delete_lead', 'edit_lead', 'pin_lead'])
export const leadStatus = pgEnum("lead_status", ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'done', 'missed/RS', 'unqualified', 'give_up', 'blacklisted'])
export const leadType = pgEnum("lead_type", ['new', 'reloan'])
export const tagType = pgEnum("tag_type", ['follow_up', 'no_answer', 'missed_rs', 'give_up', 'blacklisted', 'done'])
export const templateTrigger = pgEnum("template_trigger", ['manual', 'auto_status_change', 'scheduled', 'appointment_booked', 'appointment_reminder'])


export const t3GalleryCalendarExceptions = pgTable("t3gallery_calendar_exceptions", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_calendar_exceptions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	date: date().notNull(),
	isClosed: boolean("is_closed").default(false),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const t3GalleryAppointments = pgTable("t3gallery_appointments", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_appointments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	leadId: integer("lead_id").notNull(),
	agentId: varchar("agent_id", { length: 256 }).notNull(),
	status: varchar({ length: 50 }).default('upcoming').notNull(),
	notes: text(),
	startDatetime: timestamp("start_datetime", { withTimezone: true, mode: 'string' }).notNull(),
	endDatetime: timestamp("end_datetime", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	loanStatus: varchar("loan_status", { length: 50 }).default(sql`NULL`),
	loanNotes: text("loan_notes"),
	leadSource: varchar("lead_source", { length: 100 }).default('SEO'),
}, (table) => [
	index("appointment_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("appointment_lead_id_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	index("appointment_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [t3GalleryLeads.id],
			name: "t3gallery_appointments_lead_id_t3gallery_leads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_appointments_agent_id_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryImages = pgTable("t3gallery_images", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_images_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 256 }).notNull(),
	url: varchar({ length: 1024 }).notNull(),
	userId: varchar({ length: 256 }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryLeadNotes = pgTable("t3gallery_lead_notes", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_lead_notes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	leadId: integer("lead_id").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	index("lead_notes_lead_id_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [t3GalleryLeads.id],
			name: "t3gallery_lead_notes_lead_id_t3gallery_leads_id_fk"
		}).onDelete("cascade"),
]);

export const t3GalleryCheckedInAgents = pgTable("t3gallery_checked_in_agents", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_checked_in_agents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	agentId: varchar("agent_id", { length: 256 }).notNull(),
	checkedInDate: date("checked_in_date").default(sql`CURRENT_DATE`).notNull(),
	leadCapacity: integer("lead_capacity").default(10),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	weight: integer().default(1),
	currentLeadCount: integer("current_lead_count").default(0),
	lastAssignedAt: timestamp("last_assigned_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("checked_in_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("checked_in_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("checked_in_date_idx").using("btree", table.checkedInDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_checked_in_agents_agent_id_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryCalendarSettings = pgTable("t3gallery_calendar_settings", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_calendar_settings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 100 }).notNull(),
	workingDays: json("working_days"),
	dailyStartTime: time("daily_start_time"),
	dailyEndTime: time("daily_end_time"),
	slotDurationMinutes: integer("slot_duration_minutes"),
	defaultMaxCapacity: integer("default_max_capacity").default(1),
	timezone: varchar({ length: 50 }).default('UTC'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_calendar_settings_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_calendar_settings_updated_by_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryLeads = pgTable("t3gallery_leads", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_leads_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	fullName: varchar("full_name", { length: 255 }).default('),
	email: varchar({ length: 255 }).default('),
	residentialStatus: varchar("residential_status", { length: 50 }).default('),
	employmentStatus: varchar("employment_status", { length: 50 }).default('),
	loanPurpose: varchar("loan_purpose", { length: 100 }).default('),
	existingLoans: varchar("existing_loans", { length: 50 }).default('),
	amount: varchar({ length: 50 }).default('),
	status: varchar({ length: 50 }).default('new').notNull(),
	source: varchar({ length: 100 }).default('System'),
	assignedTo: varchar("assigned_to", { length: 256 }),
	leadType: varchar("lead_type", { length: 50 }).default('new'),
	eligibilityChecked: boolean("eligibility_checked").default(false),
	eligibilityStatus: varchar("eligibility_status", { length: 50 }).default('),
	eligibilityNotes: text("eligibility_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	phoneNumber2: varchar("phone_number_2", { length: 20 }).default('),
	phoneNumber3: varchar("phone_number_3", { length: 20 }).default('),
	leadScore: integer("lead_score").default(0),
	contactPreference: varchar("contact_preference", { length: 50 }).default('No Preferences'),
	communicationLanguage: varchar("communication_language", { length: 50 }).default('No Preferences'),
	followUpDate: timestamp("follow_up_date", { withTimezone: true, mode: 'string' }),
	hasProofOfResidence: boolean("has_proof_of_residence").default(false),
	hasLetterOfConsent: boolean("has_letter_of_consent").default(false),
	employmentSalary: varchar("employment_salary", { length: 50 }).default('),
	employmentLength: varchar("employment_length", { length: 50 }).default('),
	outstandingLoanAmount: varchar("outstanding_loan_amount", { length: 255 }).default('),
	hasWorkPassExpiry: varchar("has_work_pass_expiry", { length: 255 }).default('),
	hasPayslip3Months: boolean("has_payslip_3months").default(false),
	proofOfResidenceType: varchar("proof_of_residence_type", { length: 50 }).default('),
	isContactable: boolean("is_contactable").default(false),
	isDeleted: boolean("is_deleted").default(false),
	hasExported: boolean("has_exported").default(false),
	exportedAt: timestamp("exported_at", { withTimezone: true, mode: 'string' }),
	loanStatus: varchar("loan_status", { length: 50 }).default(sql`NULL`),
	loanNotes: text("loan_notes"),
	applyCount: integer("apply_count").default(1),
}, (table) => [
	index("lead_assigned_to_idx").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
	index("lead_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("lead_phone_idx").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	index("lead_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryLeadActions = pgTable("t3gallery_lead_actions", {
	actionId: integer("action_id").primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_lead_actions_action_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	leadId: integer("lead_id"),
	userId: varchar("user_id", { length: 256 }).notNull(),
	actionType: varchar("action_type", { length: 50 }).notNull(),
	content: text(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
}, (table) => [
	index("lead_action_lead_id_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_lead_actions_user_id_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryPermissions = pgTable("t3gallery_permissions", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_permissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("permission_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryReportSnapshots = pgTable("t3gallery_report_snapshots", {
	reportId: integer("report_id").primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_report_snapshots_report_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	reportDate: date("report_date").notNull(),
	type: varchar({ length: 100 }).notNull(),
	data: json(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const t3GalleryTimeslots = pgTable("t3gallery_timeslots", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_timeslots_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	date: date().notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	maxCapacity: integer("max_capacity").default(1),
	occupiedCount: integer("occupied_count").default(0),
	calendarSettingId: integer("calendar_setting_id"),
	isDisabled: boolean("is_disabled").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_timeslots_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_timeslots_updated_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.calendarSettingId],
			foreignColumns: [t3GalleryCalendarSettings.id],
			name: "t3gallery_timeslots_calendar_setting_id_t3gallery_calendar_sett"
		}),
]);

export const t3GalleryTags = pgTable("t3gallery_tags", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_tags_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 100 }).notNull(),
	type: varchar({ length: 50 }).notNull(),
	description: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("tag_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("tag_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	unique("t3gallery_tags_name_unique").on(table.name),
]);

export const t3GalleryLogs = pgTable("t3gallery_logs", {
	logId: integer("log_id").primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_logs_log_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	description: text(),
	entityType: varchar("entity_type", { length: 100 }).notNull(),
	entityId: varchar("entity_id", { length: 256 }).notNull(),
	action: varchar({ length: 50 }).notNull(),
	performedBy: varchar("performed_by", { length: 256 }),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const t3GalleryRoles = pgTable("t3gallery_roles", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_roles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("role_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("t3gallery_roles_name_unique").on(table.name),
]);

export const t3GalleryTemplateUsageLog = pgTable("t3gallery_template_usage_log", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_template_usage_log_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	templateId: integer("template_id"),
	leadId: integer("lead_id"),
	sentTo: varchar("sent_to", { length: 20 }).notNull(),
	deliveryMethod: varchar("delivery_method", { length: 20 }).notNull(),
	status: varchar({ length: 50 }).default('pending'),
	triggerType: varchar("trigger_type", { length: 50 }).notNull(),
	parametersUsed: json("parameters_used"),
	apiResponse: json("api_response"),
	errorMessage: text("error_message"),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	sentBy: varchar("sent_by", { length: 256 }),
}, (table) => [
	index("template_usage_date_idx").using("btree", table.sentAt.asc().nullsLast().op("timestamptz_ops")),
	index("template_usage_lead_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	index("template_usage_template_idx").using("btree", table.templateId.asc().nullsLast().op("int4_ops")),
]);

export const t3GalleryAutoAssignmentSettings = pgTable("t3gallery_auto_assignment_settings", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_auto_assignment_settings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	isEnabled: boolean("is_enabled").default(false),
	assignmentMethod: varchar("assignment_method", { length: 50 }).default('round_robin'),
	currentRoundRobinIndex: integer("current_round_robin_index").default(0),
	lastAssignedAgentId: varchar("last_assigned_agent_id", { length: 256 }),
	maxLeadsPerAgentPerDay: integer("max_leads_per_agent_per_day").default(20),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	index("auto_assignment_settings_enabled_idx").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
]);

export const t3GalleryLeadAssignmentHistory = pgTable("t3gallery_lead_assignment_history", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_lead_assignment_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	leadId: integer("lead_id").notNull(),
	assignedTo: varchar("assigned_to", { length: 256 }).notNull(),
	assignedBy: varchar("assigned_by", { length: 256 }),
	assignmentMethod: varchar("assignment_method", { length: 50 }).notNull(),
	assignmentReason: text("assignment_reason"),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	index("assignment_history_agent_idx").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
	index("assignment_history_date_idx").using("btree", table.assignedAt.asc().nullsLast().op("timestamptz_ops")),
	index("assignment_history_lead_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [t3GalleryLeads.id],
			name: "t3gallery_lead_assignment_history_lead_id_t3gallery_leads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_lead_assignment_history_assigned_to_t3gallery_users_i"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_lead_assignment_history_assigned_by_t3gallery_users_i"
		}),
]);

export const t3GalleryWhatsappTemplates = pgTable("t3gallery_whatsapp_templates", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_whatsapp_templates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	templateId: varchar("template_id", { length: 100 }).default('WIP'),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
	channelId: varchar("channel_id", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	isActive: boolean("is_active").default(true),
	triggerOnStatus: json("trigger_on_status"),
	autoSend: boolean("auto_send").default(false),
	supportedMethods: json("supported_methods").notNull(),
	defaultMethod: varchar("default_method", { length: 20 }).default('whatsapp'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	customerType: varchar("customer_type", { length: 20 }).default('new').notNull(),
}, (table) => [
	index("whatsapp_template_customer_type_idx").using("btree", table.customerType.asc().nullsLast().op("text_ops")),
	index("whatsapp_template_id_idx").using("btree", table.templateId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_whatsapp_templates_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_whatsapp_templates_updated_by_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryTemplateVariables = pgTable("t3gallery_template_variables", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_template_variables_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	templateId: integer("template_id").notNull(),
	variableKey: varchar("variable_key", { length: 100 }).notNull(),
	variableType: varchar("variable_type", { length: 50 }).default('string'),
	dataSource: varchar("data_source", { length: 100 }).notNull(),
	defaultValue: text("default_value"),
	formatPattern: varchar("format_pattern", { length: 255 }),
	isRequired: boolean("is_required").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("template_var_key_idx").using("btree", table.variableKey.asc().nullsLast().op("text_ops")),
	index("template_var_template_idx").using("btree", table.templateId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [t3GalleryWhatsappTemplates.id],
			name: "t3gallery_template_variables_template_id_t3gallery_whatsapp_tem"
		}).onDelete("cascade"),
]);

export const t3GalleryBorrowerNotes = pgTable("t3gallery_borrower_notes", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_borrower_notes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	borrowerId: integer("borrower_id").notNull(),
	content: text().notNull(),
	noteType: varchar("note_type", { length: 50 }).default('general'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	index("borrower_notes_borrower_id_idx").using("btree", table.borrowerId.asc().nullsLast().op("int4_ops")),
	index("borrower_notes_type_idx").using("btree", table.noteType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_borrower_notes_borrower_id_t3gallery_borrowers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_notes_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_notes_updated_by_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryPlaybookContacts = pgTable("t3gallery_playbook_contacts", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_playbook_contacts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	playbookId: integer("playbook_id").notNull(),
	leadId: integer("lead_id").notNull(),
	samespaceContactId: varchar("samespace_contact_id", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	firstName: varchar("first_name", { length: 255 }).default('),
	lastName: varchar("last_name", { length: 255 }).default('),
	dataSource: varchar("data_source", { length: 100 }).default('AirConnect'),
	status: varchar({ length: 50 }).default('pending'),
	syncStatus: varchar("sync_status", { length: 50 }).default('pending'),
	apiResponse: json("api_response"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("playbook_contacts_lead_idx").using("btree", table.leadId.asc().nullsLast().op("int4_ops")),
	index("playbook_contacts_phone_idx").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	index("playbook_contacts_playbook_idx").using("btree", table.playbookId.asc().nullsLast().op("int4_ops")),
	index("playbook_contacts_unique_idx").using("btree", table.playbookId.asc().nullsLast().op("int4_ops"), table.leadId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.playbookId],
			foreignColumns: [t3GalleryPlaybooks.id],
			name: "t3gallery_playbook_contacts_playbook_id_t3gallery_playbooks_id_"
		}).onDelete("cascade"),
]);

export const t3GalleryBorrowerAppointments = pgTable("t3gallery_borrower_appointments", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_borrower_appointments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	borrowerId: integer("borrower_id").notNull(),
	agentId: varchar("agent_id", { length: 256 }).notNull(),
	status: varchar({ length: 50 }).default('upcoming').notNull(),
	appointmentType: varchar("appointment_type", { length: 50 }).default('reloan_consultation'),
	loanStatus: varchar("loan_status", { length: 50 }).default(sql`NULL`),
	loanNotes: text("loan_notes"),
	notes: text(),
	leadSource: varchar("lead_source", { length: 50 }).default('),
	startDatetime: timestamp("start_datetime", { withTimezone: true, mode: 'string' }).notNull(),
	endDatetime: timestamp("end_datetime", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
}, (table) => [
	index("borrower_appointment_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("borrower_appointment_borrower_id_idx").using("btree", table.borrowerId.asc().nullsLast().op("int4_ops")),
	index("borrower_appointment_datetime_idx").using("btree", table.startDatetime.asc().nullsLast().op("timestamptz_ops")),
	index("borrower_appointment_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_borrower_appointments_borrower_id_t3gallery_borrowers"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_appointments_agent_id_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_appointments_created_by_t3gallery_users_id_f"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_appointments_updated_by_t3gallery_users_id_f"
		}),
]);

export const t3GalleryBorrowers = pgTable("t3gallery_borrowers", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_borrowers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	atomBorrowerId: varchar("atom_borrower_id", { length: 100 }).default('),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	phoneNumber2: varchar("phone_number_2", { length: 20 }).default('),
	phoneNumber3: varchar("phone_number_3", { length: 20 }).default('),
	email: varchar({ length: 255 }).default('),
	residentialStatus: varchar("residential_status", { length: 50 }).default('),
	status: varchar({ length: 50 }).notNull(),
	source: varchar({ length: 50 }).default('),
	aaStatus: varchar("aa_status", { length: 20 }).default('pending').notNull(),
	idType: varchar("id_type", { length: 50 }).notNull(),
	idNumber: varchar("id_number", { length: 50 }).default('),
	incomeDocumentType: varchar("income_document_type", { length: 50 }).default('),
	currentEmployer: varchar("current_employer", { length: 255 }).default('),
	averageMonthlyIncome: varchar("average_monthly_income", { length: 50 }).default('),
	annualIncome: varchar("annual_income", { length: 50 }).default('),
	estimatedReloanAmount: varchar("estimated_reloan_amount", { length: 50 }).default('),
	loanId: varchar("loan_id", { length: 100 }).default('),
	latestCompletedLoanDate: date("latest_completed_loan_date"),
	creditScore: varchar("credit_score", { length: 50 }).default('),
	loanAmount: varchar("loan_amount", { length: 50 }).default('),
	loanStatus: varchar("loan_status", { length: 50 }).default(sql`NULL`),
	loanNotes: text("loan_notes"),
	leadScore: integer("lead_score").default(0),
	financialCommitmentChange: varchar("financial_commitment_change", { length: 50 }).default('not_applicable'),
	contactPreference: varchar("contact_preference", { length: 50 }).default('No Preferences'),
	communicationLanguage: varchar("communication_language", { length: 50 }).default('No Preferences'),
	followUpDate: timestamp("follow_up_date", { withTimezone: true, mode: 'string' }),
	assignedTo: varchar("assigned_to", { length: 256 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	isDeleted: boolean("is_deleted").default(false),
	isInClosedLoan: varchar("is_in_closed_loan", { length: 10 }).default('),
	isIn2NdReloan: varchar("is_in_2nd_reloan", { length: 10 }).default('),
	isInAttrition: varchar("is_in_attrition", { length: 10 }).default('),
	isInLastPaymentDue: varchar("is_in_last_payment_due", { length: 10 }).default('),
	isInBhv1: varchar("is_in_bhv1", { length: 10 }).default('),
	employmentStatusChanged: boolean("employment_status_changed").default(false),
	employmentChangeDetails: text("employment_change_details"),
	workPassExpiryStatus: varchar("work_pass_expiry_status", { length: 50 }).default('not_applicable'),
	customerExperienceFeedback: text("customer_experience_feedback"),
	lastQuestionnaireDate: timestamp("last_questionnaire_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("borrower_aa_status_idx").using("btree", table.aaStatus.asc().nullsLast().op("text_ops")),
	index("borrower_assigned_to_idx").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
	index("borrower_atom_id_idx").using("btree", table.atomBorrowerId.asc().nullsLast().op("text_ops")),
	index("borrower_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("borrower_loan_id_idx").using("btree", table.loanId.asc().nullsLast().op("text_ops")),
	index("borrower_phone_idx").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	index("borrower_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrowers_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrowers_updated_by_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryPlaybooks = pgTable("t3gallery_playbooks", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_playbooks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 255 }).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	samespacePlaybookId: varchar("samespace_playbook_id", { length: 255 }).notNull(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }),
	description: text(),
	createdBy: varchar("created_by", { length: 256 }),
	filterStatus: json("filter_status"),
	filterAssignedTo: json("filter_assigned_to"),
	filterIncludeUnassigned: boolean("filter_include_unassigned").default(false),
	filterSources: json("filter_sources"),
	filterEmploymentStatuses: json("filter_employment_statuses"),
	filterLoanPurposes: json("filter_loan_purposes"),
	filterResidentialStatuses: json("filter_residential_statuses"),
	filterLeadTypes: json("filter_lead_types"),
	filterEligibilityStatuses: json("filter_eligibility_statuses"),
	filterAmountMin: integer("filter_amount_min"),
	filterAmountMax: integer("filter_amount_max"),
	filterDateFrom: varchar("filter_date_from", { length: 20 }),
	filterDateTo: varchar("filter_date_to", { length: 20 }),
	filterFollowUpDateFrom: varchar("filter_follow_up_date_from", { length: 20 }),
	filterFollowUpDateTo: varchar("filter_follow_up_date_to", { length: 20 }),
	filterAssignedInLastDays: integer("filter_assigned_in_last_days"),
	callScript: text("call_script"),
	timesetId: varchar("timeset_id", { length: 255 }),
	teamId: varchar("team_id", { length: 255 }),
	autoSyncEnabled: boolean("auto_sync_enabled").default(true),
	syncFrequency: varchar("sync_frequency", { length: 50 }).default('daily'),
}, (table) => [
	index("playbooks_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("playbooks_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	index("playbooks_samespace_idx").using("btree", table.samespacePlaybookId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_playbooks_created_by_t3gallery_users_id_fk"
		}),
	unique("t3gallery_playbooks_samespace_playbook_id_unique").on(table.samespacePlaybookId),
]);

export const t3GalleryBorrowerActions = pgTable("t3gallery_borrower_actions", {
	actionId: integer("action_id").primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_borrower_actions_action_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	borrowerId: integer("borrower_id").notNull(),
	userId: varchar("user_id", { length: 256 }).notNull(),
	actionType: varchar("action_type", { length: 50 }).notNull(),
	content: text(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
}, (table) => [
	index("borrower_action_borrower_id_idx").using("btree", table.borrowerId.asc().nullsLast().op("int4_ops")),
	index("borrower_action_type_idx").using("btree", table.actionType.asc().nullsLast().op("text_ops")),
	index("borrower_action_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_actions_user_id_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_borrower_actions_borrower_id_t3gallery_borrowers_id_f"
		}).onDelete("cascade"),
]);

export const t3GalleryLoanPlans = pgTable("t3gallery_loan_plans", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_loan_plans_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	loanId: varchar("loan_id", { length: 100 }).notNull(),
	borrowerId: integer("borrower_id").notNull(),
	planDetails: json("plan_details"),
	interestRate: varchar("interest_rate", { length: 50 }).default('),
	loanTenure: varchar("loan_tenure", { length: 50 }).default('),
	monthlyInstallment: varchar("monthly_installment", { length: 50 }).default('),
	isSelected: boolean("is_selected").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	hasBd: boolean("has_bd").default(false),
	hasBhv: boolean("has_bhv").default(false),
	hasDnc: boolean("has_dnc").default(false),
	isOverdue: boolean("is_overdue").default(false),
	productName: varchar("product_name", { length: 100 }).default('),
	loanComments: text("loan_comments"),
	nextDueDate: timestamp("next_due_date", { withTimezone: true, mode: 'string' }),
	loanCompletedDate: timestamp("loan_completed_date", { withTimezone: true, mode: 'string' }),
	estimatedReloanAmount: varchar("estimated_reloan_amount", { length: 50 }).default('),
}, (table) => [
	index("loan_plans_borrower_id_idx").using("btree", table.borrowerId.asc().nullsLast().op("int4_ops")),
	index("loan_plans_loan_id_idx").using("btree", table.loanId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_loan_plans_borrower_id_t3gallery_borrowers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_loan_plans_created_by_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_loan_plans_updated_by_t3gallery_users_id_fk"
		}),
]);

export const t3GalleryAppointmentReminderLog = pgTable("t3gallery_appointment_reminder_log", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_appointment_reminder_log_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	appointmentDate: varchar("appointment_date", { length: 20 }).notNull(),
	timeSlot: varchar("time_slot", { length: 100 }).notNull(),
	app: varchar({ length: 100 }).notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	apiResponse: json("api_response"),
	errorMessage: text("error_message"),
	workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
	channelId: varchar("channel_id", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	sentBy: varchar("sent_by", { length: 256 }),
}, (table) => [
	index("reminder_app_idx").using("btree", table.app.asc().nullsLast().op("text_ops")),
	index("reminder_date_idx").using("btree", table.appointmentDate.asc().nullsLast().op("text_ops")),
	index("reminder_phone_idx").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	index("reminder_sent_at_idx").using("btree", table.sentAt.asc().nullsLast().op("timestamptz_ops")),
	index("reminder_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryManualVerificationLog = pgTable("t3gallery_manual_verification_log", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "t3gallery_manual_verification_log_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	customerHyperlink: text("customer_hyperlink").notNull(),
	app: varchar({ length: 100 }).notNull(),
	status: varchar({ length: 50 }).default('verified').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
}, (table) => [
	index("manual_verification_app_idx").using("btree", table.app.asc().nullsLast().op("text_ops")),
	index("manual_verification_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("manual_verification_phone_idx").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	index("manual_verification_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryUsers = pgTable("t3gallery_users", {
	id: varchar({ length: 256 }).primaryKey().notNull(),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	email: varchar({ length: 255 }),
	passwordHash: text("password_hash"),
	role: varchar({ length: 50 }).default('user'),
	team: varchar({ length: 100 }),
	isVerified: boolean("is_verified").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 256 }),
	updatedBy: varchar("updated_by", { length: 256 }),
	status: varchar({ length: 50 }).default('active').notNull(),
	weight: integer().default(1),
}, (table) => [
	index("user_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const t3GalleryAppointmentTimeslots = pgTable("t3gallery_appointment_timeslots", {
	appointmentId: integer("appointment_id").notNull(),
	timeslotId: integer("timeslot_id").notNull(),
	primary: boolean().default(true),
}, (table) => [
	index("appointment_timeslot_appointment_id_idx").using("btree", table.appointmentId.asc().nullsLast().op("int4_ops")),
	index("appointment_timeslot_timeslot_id_idx").using("btree", table.timeslotId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [t3GalleryAppointments.id],
			name: "t3gallery_appointment_timeslots_appointment_id_t3gallery_appoin"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.timeslotId],
			foreignColumns: [t3GalleryTimeslots.id],
			name: "t3gallery_appointment_timeslots_timeslot_id_t3gallery_timeslots"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.appointmentId, table.timeslotId], name: "t3gallery_appointment_timeslots_appointment_id_timeslot_id_pk"}),
]);

export const t3GalleryRolePermissions = pgTable("t3gallery_role_permissions", {
	roleId: integer().notNull(),
	permissionId: integer().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [t3GalleryRoles.id],
			name: "t3gallery_role_permissions_roleId_t3gallery_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [t3GalleryPermissions.id],
			name: "t3gallery_role_permissions_permissionId_t3gallery_permissions_i"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roleId, table.permissionId], name: "t3gallery_role_permissions_roleId_permissionId_pk"}),
]);

export const t3GalleryUserRoles = pgTable("t3gallery_user_roles", {
	userId: varchar({ length: 256 }).notNull(),
	roleId: integer().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [t3GalleryRoles.id],
			name: "t3gallery_user_roles_roleId_t3gallery_roles_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.roleId], name: "t3gallery_user_roles_userId_roleId_pk"}),
]);

export const t3GalleryBorrowerAppointmentTimeslots = pgTable("t3gallery_borrower_appointment_timeslots", {
	borrowerAppointmentId: integer("borrower_appointment_id").notNull(),
	timeslotId: integer("timeslot_id").notNull(),
	primary: boolean().default(true),
}, (table) => [
	index("borrower_appointment_timeslot_appointment_id_idx").using("btree", table.borrowerAppointmentId.asc().nullsLast().op("int4_ops")),
	index("borrower_appointment_timeslot_timeslot_id_idx").using("btree", table.timeslotId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.borrowerAppointmentId],
			foreignColumns: [t3GalleryBorrowerAppointments.id],
			name: "t3gallery_borrower_appointment_timeslots_borrower_appointment_i"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.timeslotId],
			foreignColumns: [t3GalleryTimeslots.id],
			name: "t3gallery_borrower_appointment_timeslots_timeslot_id_t3gallery_"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.borrowerAppointmentId, table.timeslotId], name: "borrower_appointment_timeslots_pk"}),
]);

export const t3GalleryLeadTags = pgTable("t3gallery_lead_tags", {
	leadId: integer("lead_id").notNull(),
	tagId: integer("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
}, (table) => [
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [t3GalleryLeads.id],
			name: "t3gallery_lead_tags_lead_id_t3gallery_leads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [t3GalleryTags.id],
			name: "t3gallery_lead_tags_tag_id_t3gallery_tags_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_lead_tags_created_by_t3gallery_users_id_fk"
		}),
	primaryKey({ columns: [table.leadId, table.tagId], name: "t3gallery_lead_tags_lead_id_tag_id_pk"}),
]);

export const t3GalleryBorrowerTags = pgTable("t3gallery_borrower_tags", {
	borrowerId: integer("borrower_id").notNull(),
	tagId: integer("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
}, (table) => [
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_borrower_tags_borrower_id_t3gallery_borrowers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [t3GalleryTags.id],
			name: "t3gallery_borrower_tags_tag_id_t3gallery_tags_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_borrower_tags_created_by_t3gallery_users_id_fk"
		}),
	primaryKey({ columns: [table.borrowerId, table.tagId], name: "t3gallery_borrower_tags_borrower_id_tag_id_pk"}),
]);

export const t3GalleryPlaybookAgents = pgTable("t3gallery_playbook_agents", {
	playbookId: integer("playbook_id").notNull(),
	agentId: varchar("agent_id", { length: 256 }).notNull(),
	assignedBy: varchar("assigned_by", { length: 256 }).notNull(),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("playbook_agents_agent_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("playbook_agents_assigned_by_idx").using("btree", table.assignedBy.asc().nullsLast().op("text_ops")),
	index("playbook_agents_playbook_idx").using("btree", table.playbookId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.playbookId],
			foreignColumns: [t3GalleryPlaybooks.id],
			name: "t3gallery_playbook_agents_playbook_id_t3gallery_playbooks_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_playbook_agents_agent_id_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_playbook_agents_assigned_by_t3gallery_users_id_fk"
		}),
	primaryKey({ columns: [table.playbookId, table.agentId], name: "t3gallery_playbook_agents_playbook_id_agent_id_pk"}),
]);

export const t3GalleryPinnedLeads = pgTable("t3gallery_pinned_leads", {
	userId: varchar("user_id", { length: 256 }).notNull(),
	leadId: integer("lead_id").notNull(),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	reason: text(),
	primary: boolean().default(false),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_pinned_leads_user_id_t3gallery_users_id_fk"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [t3GalleryLeads.id],
			name: "t3gallery_pinned_leads_lead_id_t3gallery_leads_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.leadId], name: "t3gallery_pinned_leads_user_id_lead_id_pk"}),
]);

export const t3GalleryPinnedBorrowers = pgTable("t3gallery_pinned_borrowers", {
	userId: varchar("user_id", { length: 256 }).notNull(),
	borrowerId: integer("borrower_id").notNull(),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	reason: text(),
	primary: boolean().default(false),
}, (table) => [
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [t3GalleryBorrowers.id],
			name: "t3gallery_pinned_borrowers_borrower_id_t3gallery_borrowers_id_f"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [t3GalleryUsers.id],
			name: "t3gallery_pinned_borrowers_user_id_t3gallery_users_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.borrowerId], name: "t3gallery_pinned_borrowers_user_id_borrower_id_pk"}),
]);
