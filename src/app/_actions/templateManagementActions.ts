'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from "~/server/db";
import { whatsappTemplates, templateVariables } from "~/server/db/schema";
import { eq, and } from 'drizzle-orm';

interface CreateTemplateInput {
  template_id?: string;
  name: string;
  description?: string;
  workspace_id: string;
  channel_id: string;
  project_id: string;
  supported_methods: ('sms' | 'whatsapp' | 'both')[];
  default_method: 'sms' | 'whatsapp' | 'both';
  trigger_on_status?: string[];
  auto_send?: boolean;
  variables: Array<{
    variable_key: string;
    variable_type: 'string' | 'number' | 'date';
    data_source: string;
    default_value?: string;
    format_pattern?: string;
    is_required: boolean;
  }>;
}

interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: number;
}

// Create a new WhatsApp template
export async function createWhatsAppTemplate(input: CreateTemplateInput) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Auto-generate template_id from name if not provided
    let templateId = input.template_id;
    if (!templateId || templateId.trim() === '') {
      // Generate from name: "No Answer Follow-up" -> "no_answer_follow_up_123456"
      templateId = input.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 40); // Limit length
      
      // Add timestamp to ensure uniqueness
      templateId += `_${Date.now().toString().slice(-6)}`;
    }

    // Check if template_id already exists (just in case)
    const existing = await db.select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.template_id, templateId))
      .limit(1);

    if (existing.length > 0) {
      // If exists, add more unique suffix
      templateId += `_${Math.random().toString(36).substring(2, 8)}`;
    }

    // Create template
    const [template] = await db.insert(whatsappTemplates).values({
      template_id: templateId,
      name: input.name,
      description: input.description,
      workspace_id: input.workspace_id,
      channel_id: input.channel_id,
      project_id: input.project_id,
      supported_methods: input.supported_methods,
      default_method: input.default_method,
      trigger_on_status: input.trigger_on_status ?? [],
      auto_send: input.auto_send ?? false,
      created_by: userId,
      updated_by: userId,
    }).returning();

    if (!template) {
      return { success: false, error: 'Failed to create template' };
    }

    // Create variables
    if (input.variables && input.variables.length > 0) {
      const variableValues = input.variables.map(variable => ({
        template_id: template.id,
        variable_key: variable.variable_key,
        variable_type: variable.variable_type,
        data_source: variable.data_source,
        default_value: variable.default_value,
        format_pattern: variable.format_pattern,
        is_required: variable.is_required,
      }));

      await db.insert(templateVariables).values(variableValues);
    }

    // Fetch the complete template with variables for return
    const variables = await db.select()
      .from(templateVariables)
      .where(eq(templateVariables.template_id, template.id));

    const completeTemplate = {
      ...template,
      variables,
    };

    return { success: true, template: completeTemplate };
  } catch (error) {
    console.error('Error creating WhatsApp template:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Update an existing WhatsApp template
export async function updateWhatsAppTemplate(input: UpdateTemplateInput) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if template exists
    const existing = await db.select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, input.id))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Template not found' };
    }

    // Update template
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date(),
    };

    if (input.name) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.workspace_id) updateData.workspace_id = input.workspace_id;
    if (input.channel_id) updateData.channel_id = input.channel_id;
    if (input.project_id) updateData.project_id = input.project_id;
    if (input.supported_methods) updateData.supported_methods = input.supported_methods;
    if (input.default_method) updateData.default_method = input.default_method;
    if (input.trigger_on_status !== undefined) updateData.trigger_on_status = input.trigger_on_status;
    if (input.auto_send !== undefined) updateData.auto_send = input.auto_send;

    const [template] = await db.update(whatsappTemplates)
      .set(updateData)
      .where(eq(whatsappTemplates.id, input.id))
      .returning();

    // Update variables if provided
    if (input.variables) {
      // Delete existing variables
      await db.delete(templateVariables)
        .where(eq(templateVariables.template_id, input.id));

      // Insert new variables
      if (input.variables.length > 0) {
        const variableValues = input.variables.map(variable => ({
          template_id: input.id,
          variable_key: variable.variable_key,
          variable_type: variable.variable_type,
          data_source: variable.data_source,
          default_value: variable.default_value,
          format_pattern: variable.format_pattern,
          is_required: variable.is_required,
        }));

        await db.insert(templateVariables).values(variableValues);
      }
    }

    return { success: true, template };
  } catch (error) {
    console.error('Error updating WhatsApp template:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get all WhatsApp templates with their variables
export async function getAllWhatsAppTemplates() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const templates = await db.select()
      .from(whatsappTemplates)
      .orderBy(whatsappTemplates.created_at);

    const templatesWithVariables = await Promise.all(
      templates.map(async (template) => {
        const variables = await db.select()
          .from(templateVariables)
          .where(eq(templateVariables.template_id, template.id));

        return {
          ...template,
          variables,
        };
      })
    );

    return { success: true, templates: templatesWithVariables };
  } catch (error) {
    console.error('Error fetching WhatsApp templates:', error);
    return { 
      success: false, 
      error: 'Failed to fetch templates' 
    };
  }
}

// Delete a WhatsApp template
export async function deleteWhatsAppTemplate(templateId: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if template exists
    const existing = await db.select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, templateId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Template not found' };
    }

    // Delete template (cascade will delete variables)
    await db.delete(whatsappTemplates)
      .where(eq(whatsappTemplates.id, templateId));

    return { success: true, message: 'Template deleted successfully' };
  } catch (error) {
    console.error('Error deleting WhatsApp template:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Toggle template active status
export async function toggleTemplateStatus(templateId: number, isActive: boolean) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const [template] = await db.update(whatsappTemplates)
      .set({ 
        is_active: isActive,
        updated_by: userId,
        updated_at: new Date()
      })
      .where(eq(whatsappTemplates.id, templateId))
      .returning();

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, template };
  } catch (error) {
    console.error('Error toggling template status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get data source suggestions for template variables
export async function getDataSourceSuggestions() {
  return {
    lead: [
      'lead.full_name',
      'lead.phone_number',
      'lead.email',
      'lead.amount',
      'lead.loan_purpose',
      'lead.employment_status',
      'lead.employment_salary',
      'lead.residential_status',
      'lead.source',
      'lead.status',
    ],
    user: [
      'user.first_name',
      'user.last_name',
      'user.email',
      'user.team',
    ],
    system: [
      'system.date',
      'system.datetime',
      'system.time',
    ]
  };
}

// Validate template configuration
export async function validateTemplateConfiguration(input: CreateTemplateInput | UpdateTemplateInput) {
  const errors: string[] = [];

  // Template ID is now auto-generated, so no validation needed
  
  if ('name' in input && !input.name) {
    errors.push('Template name is required');
  }

  if ('workspace_id' in input && !input.workspace_id) {
    errors.push('Workspace ID is required');
  }

  if ('channel_id' in input && !input.channel_id) {
    errors.push('Channel ID is required');
  }

  if ('project_id' in input && !input.project_id) {
    errors.push('Project ID is required');
  }

  if ('supported_methods' in input && (!input.supported_methods || input.supported_methods.length === 0)) {
    errors.push('At least one supported method is required');
  }

  if ('default_method' in input && input.supported_methods && input.default_method && !input.supported_methods.includes(input.default_method)) {
    errors.push('Default method must be one of the supported methods');
  }

  if ('variables' in input && input.variables) {
    input.variables.forEach((variable, index) => {
      if (!variable.variable_key) {
        errors.push(`Variable ${index + 1}: Key is required`);
      }
      if (!variable.data_source) {
        errors.push(`Variable ${index + 1}: Data source is required`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 