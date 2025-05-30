CREATE TYPE "public"."action_type" AS ENUM('call', 'whatsapp', 'note', 'assigned', 'others');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('upcoming', 'cancelled', 'done', 'missed');--> statement-breakpoint
CREATE TYPE "public"."lead_card_action" AS ENUM('view', 'add_note', 'schedule_appointment', 'make_call', 'send_message', 'change_status', 'assign_lead', 'delete_lead', 'edit_lead', 'pin_lead');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'open', 'contacted', 'no_answer', 'follow_up', 'booked', 'unqualified', 'give_up', 'blacklisted');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('acquisition', 'referral', 'inbound', 'outbound');--> statement-breakpoint
CREATE TABLE "t3gallery_appointment_timeslots" (
	"appointment_id" integer NOT NULL,
	"timeslot_id" integer NOT NULL,
	"primary" boolean DEFAULT true,
	CONSTRAINT "t3gallery_appointment_timeslots_appointment_id_timeslot_id_pk" PRIMARY KEY("appointment_id","timeslot_id")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_appointments" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" integer NOT NULL,
	"agent_id" varchar(256) NOT NULL,
	"status" varchar(50) DEFAULT 'upcoming' NOT NULL,
	"notes" text,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_calendar_exceptions" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_calendar_exceptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT false,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "t3gallery_calendar_settings" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_calendar_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"working_days" json,
	"daily_start_time" time,
	"daily_end_time" time,
	"slot_duration_minutes" integer,
	"default_max_capacity" integer DEFAULT 1,
	"timezone" varchar(50) DEFAULT 'UTC',
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_images" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(256) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"userId" varchar(256) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "t3gallery_lead_actions" (
	"action_id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_lead_actions_action_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" integer NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"content" text,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_lead_notes" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_lead_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_leads" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_leads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"email" varchar(255),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"source" varchar(100),
	"assigned_to" varchar(256),
	"lead_type" varchar(50) DEFAULT 'acquisition',
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_logs" (
	"log_id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_logs_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"description" text,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(256) NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" varchar(256),
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t3gallery_permissions" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "t3gallery_permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_pinned_leads" (
	"user_id" varchar(256) NOT NULL,
	"lead_id" integer NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"reason" text,
	"primary" boolean DEFAULT false,
	CONSTRAINT "t3gallery_pinned_leads_user_id_lead_id_pk" PRIMARY KEY("user_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_report_snapshots" (
	"report_id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_report_snapshots_report_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"report_date" date NOT NULL,
	"type" varchar(100) NOT NULL,
	"data" json,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t3gallery_role_permissions" (
	"roleId" integer NOT NULL,
	"permissionId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "t3gallery_role_permissions_roleId_permissionId_pk" PRIMARY KEY("roleId","permissionId")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_roles" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "t3gallery_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_timeslots" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "t3gallery_timeslots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"max_capacity" integer DEFAULT 1,
	"occupied_count" integer DEFAULT 0,
	"calendar_setting_id" integer,
	"is_disabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "t3gallery_user_roles" (
	"userId" varchar(256) NOT NULL,
	"roleId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "t3gallery_user_roles_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
CREATE TABLE "t3gallery_users" (
	"id" varchar(256) PRIMARY KEY NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"email" varchar(255),
	"password_hash" text,
	"role" varchar(50) DEFAULT 'user',
	"team" varchar(100),
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" varchar(256),
	"updated_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "t3gallery_appointment_timeslots" ADD CONSTRAINT "t3gallery_appointment_timeslots_appointment_id_t3gallery_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."t3gallery_appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_appointment_timeslots" ADD CONSTRAINT "t3gallery_appointment_timeslots_timeslot_id_t3gallery_timeslots_id_fk" FOREIGN KEY ("timeslot_id") REFERENCES "public"."t3gallery_timeslots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_appointments" ADD CONSTRAINT "t3gallery_appointments_lead_id_t3gallery_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."t3gallery_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_appointments" ADD CONSTRAINT "t3gallery_appointments_agent_id_t3gallery_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_appointments" ADD CONSTRAINT "t3gallery_appointments_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_appointments" ADD CONSTRAINT "t3gallery_appointments_updated_by_t3gallery_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_calendar_settings" ADD CONSTRAINT "t3gallery_calendar_settings_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_calendar_settings" ADD CONSTRAINT "t3gallery_calendar_settings_updated_by_t3gallery_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_actions" ADD CONSTRAINT "t3gallery_lead_actions_lead_id_t3gallery_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."t3gallery_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_actions" ADD CONSTRAINT "t3gallery_lead_actions_user_id_t3gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_actions" ADD CONSTRAINT "t3gallery_lead_actions_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_notes" ADD CONSTRAINT "t3gallery_lead_notes_lead_id_t3gallery_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."t3gallery_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_notes" ADD CONSTRAINT "t3gallery_lead_notes_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_lead_notes" ADD CONSTRAINT "t3gallery_lead_notes_updated_by_t3gallery_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_leads" ADD CONSTRAINT "t3gallery_leads_assigned_to_t3gallery_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_leads" ADD CONSTRAINT "t3gallery_leads_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_leads" ADD CONSTRAINT "t3gallery_leads_updated_by_t3gallery_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_logs" ADD CONSTRAINT "t3gallery_logs_performed_by_t3gallery_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_pinned_leads" ADD CONSTRAINT "t3gallery_pinned_leads_user_id_t3gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_pinned_leads" ADD CONSTRAINT "t3gallery_pinned_leads_lead_id_t3gallery_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."t3gallery_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_role_permissions" ADD CONSTRAINT "t3gallery_role_permissions_roleId_t3gallery_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."t3gallery_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_role_permissions" ADD CONSTRAINT "t3gallery_role_permissions_permissionId_t3gallery_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."t3gallery_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_timeslots" ADD CONSTRAINT "t3gallery_timeslots_calendar_setting_id_t3gallery_calendar_settings_id_fk" FOREIGN KEY ("calendar_setting_id") REFERENCES "public"."t3gallery_calendar_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_timeslots" ADD CONSTRAINT "t3gallery_timeslots_created_by_t3gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_timeslots" ADD CONSTRAINT "t3gallery_timeslots_updated_by_t3gallery_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."t3gallery_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t3gallery_user_roles" ADD CONSTRAINT "t3gallery_user_roles_roleId_t3gallery_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."t3gallery_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_lead_id_idx" ON "t3gallery_appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "appointment_agent_id_idx" ON "t3gallery_appointments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "appointment_status_idx" ON "t3gallery_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "name_idx" ON "t3gallery_images" USING btree ("name");--> statement-breakpoint
CREATE INDEX "lead_action_lead_id_idx" ON "t3gallery_lead_actions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_notes_lead_id_idx" ON "t3gallery_lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_email_idx" ON "t3gallery_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_status_idx" ON "t3gallery_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lead_assigned_to_idx" ON "t3gallery_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "permission_name_idx" ON "t3gallery_permissions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "role_name_idx" ON "t3gallery_roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "t3gallery_users" USING btree ("email");