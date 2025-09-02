import { relations } from "drizzle-orm/relations";
import { t3GalleryLeads, t3GalleryAppointments, t3GalleryUsers, t3GalleryLeadNotes, t3GalleryCheckedInAgents, t3GalleryCalendarSettings, t3GalleryLeadActions, t3GalleryTimeslots, t3GalleryLeadAssignmentHistory, t3GalleryWhatsappTemplates, t3GalleryTemplateVariables, t3GalleryBorrowers, t3GalleryBorrowerNotes, t3GalleryPlaybooks, t3GalleryPlaybookContacts, t3GalleryBorrowerAppointments, t3GalleryBorrowerActions, t3GalleryLoanPlans, t3GalleryAppointmentTimeslots, t3GalleryRoles, t3GalleryRolePermissions, t3GalleryPermissions, t3GalleryUserRoles, t3GalleryBorrowerAppointmentTimeslots, t3GalleryLeadTags, t3GalleryTags, t3GalleryBorrowerTags, t3GalleryPlaybookAgents, t3GalleryPinnedLeads, t3GalleryPinnedBorrowers } from "./schema";

export const t3GalleryAppointmentsRelations = relations(t3GalleryAppointments, ({one, many}) => ({
	t3GalleryLead: one(t3GalleryLeads, {
		fields: [t3GalleryAppointments.leadId],
		references: [t3GalleryLeads.id]
	}),
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryAppointments.agentId],
		references: [t3GalleryUsers.id]
	}),
	t3GalleryAppointmentTimeslots: many(t3GalleryAppointmentTimeslots),
}));

export const t3GalleryLeadsRelations = relations(t3GalleryLeads, ({many}) => ({
	t3GalleryAppointments: many(t3GalleryAppointments),
	t3GalleryLeadNotes: many(t3GalleryLeadNotes),
	t3GalleryLeadAssignmentHistories: many(t3GalleryLeadAssignmentHistory),
	t3GalleryLeadTags: many(t3GalleryLeadTags),
	t3GalleryPinnedLeads: many(t3GalleryPinnedLeads),
}));

export const t3GalleryUsersRelations = relations(t3GalleryUsers, ({many}) => ({
	t3GalleryAppointments: many(t3GalleryAppointments),
	t3GalleryCheckedInAgents: many(t3GalleryCheckedInAgents),
	t3GalleryCalendarSettings_createdBy: many(t3GalleryCalendarSettings, {
		relationName: "t3GalleryCalendarSettings_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryCalendarSettings_updatedBy: many(t3GalleryCalendarSettings, {
		relationName: "t3GalleryCalendarSettings_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryLeadActions: many(t3GalleryLeadActions),
	t3GalleryTimeslots_createdBy: many(t3GalleryTimeslots, {
		relationName: "t3GalleryTimeslots_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryTimeslots_updatedBy: many(t3GalleryTimeslots, {
		relationName: "t3GalleryTimeslots_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryLeadAssignmentHistories_assignedTo: many(t3GalleryLeadAssignmentHistory, {
		relationName: "t3GalleryLeadAssignmentHistory_assignedTo_t3GalleryUsers_id"
	}),
	t3GalleryLeadAssignmentHistories_assignedBy: many(t3GalleryLeadAssignmentHistory, {
		relationName: "t3GalleryLeadAssignmentHistory_assignedBy_t3GalleryUsers_id"
	}),
	t3GalleryWhatsappTemplates_createdBy: many(t3GalleryWhatsappTemplates, {
		relationName: "t3GalleryWhatsappTemplates_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryWhatsappTemplates_updatedBy: many(t3GalleryWhatsappTemplates, {
		relationName: "t3GalleryWhatsappTemplates_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerNotes_createdBy: many(t3GalleryBorrowerNotes, {
		relationName: "t3GalleryBorrowerNotes_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerNotes_updatedBy: many(t3GalleryBorrowerNotes, {
		relationName: "t3GalleryBorrowerNotes_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerAppointments_agentId: many(t3GalleryBorrowerAppointments, {
		relationName: "t3GalleryBorrowerAppointments_agentId_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerAppointments_createdBy: many(t3GalleryBorrowerAppointments, {
		relationName: "t3GalleryBorrowerAppointments_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerAppointments_updatedBy: many(t3GalleryBorrowerAppointments, {
		relationName: "t3GalleryBorrowerAppointments_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowers_createdBy: many(t3GalleryBorrowers, {
		relationName: "t3GalleryBorrowers_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowers_updatedBy: many(t3GalleryBorrowers, {
		relationName: "t3GalleryBorrowers_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryPlaybooks: many(t3GalleryPlaybooks),
	t3GalleryBorrowerActions: many(t3GalleryBorrowerActions),
	t3GalleryLoanPlans_createdBy: many(t3GalleryLoanPlans, {
		relationName: "t3GalleryLoanPlans_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryLoanPlans_updatedBy: many(t3GalleryLoanPlans, {
		relationName: "t3GalleryLoanPlans_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryLeadTags: many(t3GalleryLeadTags),
	t3GalleryBorrowerTags: many(t3GalleryBorrowerTags),
	t3GalleryPlaybookAgents_agentId: many(t3GalleryPlaybookAgents, {
		relationName: "t3GalleryPlaybookAgents_agentId_t3GalleryUsers_id"
	}),
	t3GalleryPlaybookAgents_assignedBy: many(t3GalleryPlaybookAgents, {
		relationName: "t3GalleryPlaybookAgents_assignedBy_t3GalleryUsers_id"
	}),
	t3GalleryPinnedLeads: many(t3GalleryPinnedLeads),
	t3GalleryPinnedBorrowers: many(t3GalleryPinnedBorrowers),
}));

export const t3GalleryLeadNotesRelations = relations(t3GalleryLeadNotes, ({one}) => ({
	t3GalleryLead: one(t3GalleryLeads, {
		fields: [t3GalleryLeadNotes.leadId],
		references: [t3GalleryLeads.id]
	}),
}));

export const t3GalleryCheckedInAgentsRelations = relations(t3GalleryCheckedInAgents, ({one}) => ({
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryCheckedInAgents.agentId],
		references: [t3GalleryUsers.id]
	}),
}));

export const t3GalleryCalendarSettingsRelations = relations(t3GalleryCalendarSettings, ({one, many}) => ({
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryCalendarSettings.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryCalendarSettings_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryCalendarSettings.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryCalendarSettings_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryTimeslots: many(t3GalleryTimeslots),
}));

export const t3GalleryLeadActionsRelations = relations(t3GalleryLeadActions, ({one}) => ({
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryLeadActions.userId],
		references: [t3GalleryUsers.id]
	}),
}));

export const t3GalleryTimeslotsRelations = relations(t3GalleryTimeslots, ({one, many}) => ({
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryTimeslots.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryTimeslots_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryTimeslots.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryTimeslots_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryCalendarSetting: one(t3GalleryCalendarSettings, {
		fields: [t3GalleryTimeslots.calendarSettingId],
		references: [t3GalleryCalendarSettings.id]
	}),
	t3GalleryAppointmentTimeslots: many(t3GalleryAppointmentTimeslots),
	t3GalleryBorrowerAppointmentTimeslots: many(t3GalleryBorrowerAppointmentTimeslots),
}));

export const t3GalleryLeadAssignmentHistoryRelations = relations(t3GalleryLeadAssignmentHistory, ({one}) => ({
	t3GalleryLead: one(t3GalleryLeads, {
		fields: [t3GalleryLeadAssignmentHistory.leadId],
		references: [t3GalleryLeads.id]
	}),
	t3GalleryUser_assignedTo: one(t3GalleryUsers, {
		fields: [t3GalleryLeadAssignmentHistory.assignedTo],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryLeadAssignmentHistory_assignedTo_t3GalleryUsers_id"
	}),
	t3GalleryUser_assignedBy: one(t3GalleryUsers, {
		fields: [t3GalleryLeadAssignmentHistory.assignedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryLeadAssignmentHistory_assignedBy_t3GalleryUsers_id"
	}),
}));

export const t3GalleryWhatsappTemplatesRelations = relations(t3GalleryWhatsappTemplates, ({one, many}) => ({
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryWhatsappTemplates.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryWhatsappTemplates_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryWhatsappTemplates.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryWhatsappTemplates_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryTemplateVariables: many(t3GalleryTemplateVariables),
}));

export const t3GalleryTemplateVariablesRelations = relations(t3GalleryTemplateVariables, ({one}) => ({
	t3GalleryWhatsappTemplate: one(t3GalleryWhatsappTemplates, {
		fields: [t3GalleryTemplateVariables.templateId],
		references: [t3GalleryWhatsappTemplates.id]
	}),
}));

export const t3GalleryBorrowerNotesRelations = relations(t3GalleryBorrowerNotes, ({one}) => ({
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryBorrowerNotes.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerNotes.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowerNotes_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerNotes.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowerNotes_updatedBy_t3GalleryUsers_id"
	}),
}));

export const t3GalleryBorrowersRelations = relations(t3GalleryBorrowers, ({one, many}) => ({
	t3GalleryBorrowerNotes: many(t3GalleryBorrowerNotes),
	t3GalleryBorrowerAppointments: many(t3GalleryBorrowerAppointments),
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowers.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowers_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowers.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowers_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerActions: many(t3GalleryBorrowerActions),
	t3GalleryLoanPlans: many(t3GalleryLoanPlans),
	t3GalleryBorrowerTags: many(t3GalleryBorrowerTags),
	t3GalleryPinnedBorrowers: many(t3GalleryPinnedBorrowers),
}));

export const t3GalleryPlaybookContactsRelations = relations(t3GalleryPlaybookContacts, ({one}) => ({
	t3GalleryPlaybook: one(t3GalleryPlaybooks, {
		fields: [t3GalleryPlaybookContacts.playbookId],
		references: [t3GalleryPlaybooks.id]
	}),
}));

export const t3GalleryPlaybooksRelations = relations(t3GalleryPlaybooks, ({one, many}) => ({
	t3GalleryPlaybookContacts: many(t3GalleryPlaybookContacts),
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryPlaybooks.createdBy],
		references: [t3GalleryUsers.id]
	}),
	t3GalleryPlaybookAgents: many(t3GalleryPlaybookAgents),
}));

export const t3GalleryBorrowerAppointmentsRelations = relations(t3GalleryBorrowerAppointments, ({one, many}) => ({
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryBorrowerAppointments.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
	t3GalleryUser_agentId: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerAppointments.agentId],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowerAppointments_agentId_t3GalleryUsers_id"
	}),
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerAppointments.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowerAppointments_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerAppointments.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryBorrowerAppointments_updatedBy_t3GalleryUsers_id"
	}),
	t3GalleryBorrowerAppointmentTimeslots: many(t3GalleryBorrowerAppointmentTimeslots),
}));

export const t3GalleryBorrowerActionsRelations = relations(t3GalleryBorrowerActions, ({one}) => ({
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerActions.userId],
		references: [t3GalleryUsers.id]
	}),
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryBorrowerActions.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
}));

export const t3GalleryLoanPlansRelations = relations(t3GalleryLoanPlans, ({one}) => ({
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryLoanPlans.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
	t3GalleryUser_createdBy: one(t3GalleryUsers, {
		fields: [t3GalleryLoanPlans.createdBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryLoanPlans_createdBy_t3GalleryUsers_id"
	}),
	t3GalleryUser_updatedBy: one(t3GalleryUsers, {
		fields: [t3GalleryLoanPlans.updatedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryLoanPlans_updatedBy_t3GalleryUsers_id"
	}),
}));

export const t3GalleryAppointmentTimeslotsRelations = relations(t3GalleryAppointmentTimeslots, ({one}) => ({
	t3GalleryAppointment: one(t3GalleryAppointments, {
		fields: [t3GalleryAppointmentTimeslots.appointmentId],
		references: [t3GalleryAppointments.id]
	}),
	t3GalleryTimeslot: one(t3GalleryTimeslots, {
		fields: [t3GalleryAppointmentTimeslots.timeslotId],
		references: [t3GalleryTimeslots.id]
	}),
}));

export const t3GalleryRolePermissionsRelations = relations(t3GalleryRolePermissions, ({one}) => ({
	t3GalleryRole: one(t3GalleryRoles, {
		fields: [t3GalleryRolePermissions.roleId],
		references: [t3GalleryRoles.id]
	}),
	t3GalleryPermission: one(t3GalleryPermissions, {
		fields: [t3GalleryRolePermissions.permissionId],
		references: [t3GalleryPermissions.id]
	}),
}));

export const t3GalleryRolesRelations = relations(t3GalleryRoles, ({many}) => ({
	t3GalleryRolePermissions: many(t3GalleryRolePermissions),
	t3GalleryUserRoles: many(t3GalleryUserRoles),
}));

export const t3GalleryPermissionsRelations = relations(t3GalleryPermissions, ({many}) => ({
	t3GalleryRolePermissions: many(t3GalleryRolePermissions),
}));

export const t3GalleryUserRolesRelations = relations(t3GalleryUserRoles, ({one}) => ({
	t3GalleryRole: one(t3GalleryRoles, {
		fields: [t3GalleryUserRoles.roleId],
		references: [t3GalleryRoles.id]
	}),
}));

export const t3GalleryBorrowerAppointmentTimeslotsRelations = relations(t3GalleryBorrowerAppointmentTimeslots, ({one}) => ({
	t3GalleryBorrowerAppointment: one(t3GalleryBorrowerAppointments, {
		fields: [t3GalleryBorrowerAppointmentTimeslots.borrowerAppointmentId],
		references: [t3GalleryBorrowerAppointments.id]
	}),
	t3GalleryTimeslot: one(t3GalleryTimeslots, {
		fields: [t3GalleryBorrowerAppointmentTimeslots.timeslotId],
		references: [t3GalleryTimeslots.id]
	}),
}));

export const t3GalleryLeadTagsRelations = relations(t3GalleryLeadTags, ({one}) => ({
	t3GalleryLead: one(t3GalleryLeads, {
		fields: [t3GalleryLeadTags.leadId],
		references: [t3GalleryLeads.id]
	}),
	t3GalleryTag: one(t3GalleryTags, {
		fields: [t3GalleryLeadTags.tagId],
		references: [t3GalleryTags.id]
	}),
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryLeadTags.createdBy],
		references: [t3GalleryUsers.id]
	}),
}));

export const t3GalleryTagsRelations = relations(t3GalleryTags, ({many}) => ({
	t3GalleryLeadTags: many(t3GalleryLeadTags),
	t3GalleryBorrowerTags: many(t3GalleryBorrowerTags),
}));

export const t3GalleryBorrowerTagsRelations = relations(t3GalleryBorrowerTags, ({one}) => ({
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryBorrowerTags.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
	t3GalleryTag: one(t3GalleryTags, {
		fields: [t3GalleryBorrowerTags.tagId],
		references: [t3GalleryTags.id]
	}),
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryBorrowerTags.createdBy],
		references: [t3GalleryUsers.id]
	}),
}));

export const t3GalleryPlaybookAgentsRelations = relations(t3GalleryPlaybookAgents, ({one}) => ({
	t3GalleryPlaybook: one(t3GalleryPlaybooks, {
		fields: [t3GalleryPlaybookAgents.playbookId],
		references: [t3GalleryPlaybooks.id]
	}),
	t3GalleryUser_agentId: one(t3GalleryUsers, {
		fields: [t3GalleryPlaybookAgents.agentId],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryPlaybookAgents_agentId_t3GalleryUsers_id"
	}),
	t3GalleryUser_assignedBy: one(t3GalleryUsers, {
		fields: [t3GalleryPlaybookAgents.assignedBy],
		references: [t3GalleryUsers.id],
		relationName: "t3GalleryPlaybookAgents_assignedBy_t3GalleryUsers_id"
	}),
}));

export const t3GalleryPinnedLeadsRelations = relations(t3GalleryPinnedLeads, ({one}) => ({
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryPinnedLeads.userId],
		references: [t3GalleryUsers.id]
	}),
	t3GalleryLead: one(t3GalleryLeads, {
		fields: [t3GalleryPinnedLeads.leadId],
		references: [t3GalleryLeads.id]
	}),
}));

export const t3GalleryPinnedBorrowersRelations = relations(t3GalleryPinnedBorrowers, ({one}) => ({
	t3GalleryBorrower: one(t3GalleryBorrowers, {
		fields: [t3GalleryPinnedBorrowers.borrowerId],
		references: [t3GalleryBorrowers.id]
	}),
	t3GalleryUser: one(t3GalleryUsers, {
		fields: [t3GalleryPinnedBorrowers.userId],
		references: [t3GalleryUsers.id]
	}),
}));