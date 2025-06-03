"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { 
  getAllWhatsAppTemplates,
  createWhatsAppTemplate,
  updateWhatsAppTemplate,
  deleteWhatsAppTemplate,
  toggleTemplateStatus,
  getDataSourceSuggestions,
  validateTemplateConfiguration
} from '~/app/_actions/templateManagementActions';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface Template {
  id: number;
  template_id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  channel_id: string;
  project_id: string;
  is_active: boolean;
  supported_methods: string[];
  default_method: string;
  trigger_on_status: string[] | null;
  auto_send: boolean;
  variables?: Array<{
    id: number;
    variable_key: string;
    variable_type: string;
    data_source: string;
    default_value: string | null;
    format_pattern: string | null;
    is_required: boolean;
  }>;
}

interface TemplateFormData {
  template_id?: string;
  name: string;
  description: string;
  workspace_id: string;
  channel_id: string;
  project_id: string;
  supported_methods: ('sms' | 'whatsapp' | 'both')[];
  default_method: 'sms' | 'whatsapp' | 'both';
  trigger_on_status: string[];
  auto_send: boolean;
  variables: Array<{
    variable_key: string;
    variable_type: 'string' | 'number' | 'date';
    data_source: string;
    default_value: string;
    format_pattern: string;
    is_required: boolean;
  }>;
}

interface DataSources {
  lead: string[];
  user: string[];
  system: string[];
}

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  workspace_id: '976e3394-ae10-4b32-9a23-8ecf78da9fe7',
  channel_id: '36f8cbb8-4397-48b5-a9d7-0036ba9c2c77',
  project_id: '',
  supported_methods: ['whatsapp'],
  default_method: 'whatsapp',
  auto_send: false,
  trigger_on_status: [],
  variables: [
    {
      variable_key: '',
      variable_type: 'string',
      data_source: '',
      default_value: '',
      format_pattern: '',
      is_required: true,
    }
  ]
};

const leadStatuses = [
  'new', 'assigned', 'no_answer', 'follow_up', 'booked', 
  'done', 'missed/RS', 'unqualified', 'give_up', 'blacklisted'
];

export default function WhatsAppTemplatesPage() {
  const { userId } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dataSources, setDataSources] = useState<DataSources>({ lead: [], user: [], system: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [templatesResult, dataSourcesResult] = await Promise.all([
          getAllWhatsAppTemplates(),
          getDataSourceSuggestions()
        ]);

        if (templatesResult.success) {
          setTemplates(templatesResult.templates as Template[]);
        } else {
          setError('Failed to load templates');
        }

        setDataSources(dataSourcesResult as DataSources);
      } catch (err) {
        setError('An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleCreateTemplate = async () => {
    try {
      setModalError(null);
      const validation = await validateTemplateConfiguration(formData);
      if (!validation.isValid) {
        setModalError(validation.errors.join(', '));
        return;
      }

      const result = await createWhatsAppTemplate(formData);
      if (result.success && result.template) {
        const newTemplate = result.template as unknown as Template;
        setTemplates([...templates, newTemplate]);
        setShowForm(false);
        setFormData(initialFormData);
        setModalError(null);
      } else {
        setModalError(result.error ?? 'Failed to create template');
      }
    } catch (err) {
      setModalError('An error occurred while creating the template');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setModalError(null);
      const validation = await validateTemplateConfiguration({ ...formData, id: editingTemplate.id });
      if (!validation.isValid) {
        setModalError(validation.errors.join(', '));
        return;
      }

      const result = await updateWhatsAppTemplate({ ...formData, id: editingTemplate.id });
      if (result.success && result.template) {
        const updatedTemplate = result.template as unknown as Template;
        setTemplates(templates.map(t => t.id === editingTemplate.id ? updatedTemplate : t));
        setShowForm(false);
        setEditingTemplate(null);
        setFormData(initialFormData);
        setModalError(null);
      } else {
        setModalError(result.error ?? 'Failed to update template');
      }
    } catch (err) {
      setModalError('An error occurred while updating the template');
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const result = await deleteWhatsAppTemplate(templateId);
      if (result.success) {
        setTemplates(templates.filter(t => t.id !== templateId));
      } else {
        setError(result.error ?? 'Failed to delete template');
      }
    } catch (err) {
      setError('An error occurred while deleting the template');
    }
  };

  const handleToggleStatus = async (templateId: number, isActive: boolean) => {
    try {
      const result = await toggleTemplateStatus(templateId, isActive);
      if (result.success) {
        setTemplates(templates.map(t => 
          t.id === templateId ? { ...t, is_active: isActive } : t
        ));
      } else {
        setError(result.error ?? 'Failed to toggle template status');
      }
    } catch (err) {
      setError('An error occurred while updating template status');
    }
  };

  const startEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      template_id: template.template_id,
      name: template.name,
      description: template.description ?? '',
      workspace_id: template.workspace_id,
      channel_id: template.channel_id,
      project_id: template.project_id,
      supported_methods: template.supported_methods as ('sms' | 'whatsapp' | 'both')[],
      default_method: template.default_method as 'sms' | 'whatsapp' | 'both',
      auto_send: template.auto_send,
      trigger_on_status: template.trigger_on_status ?? [],
      variables: template.variables?.map(v => ({
        variable_key: v.variable_key,
        variable_type: v.variable_type as 'string' | 'number' | 'date',
        data_source: v.data_source,
        default_value: v.default_value ?? '',
        format_pattern: v.format_pattern ?? '',
        is_required: v.is_required,
      })) ?? []
    });
    setModalError(null);
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData(initialFormData);
    setModalError(null);
  };

  const addVariable = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, {
        variable_key: '',
        variable_type: 'string',
        data_source: '',
        default_value: '',
        format_pattern: '',
        is_required: true
      }]
    });
  };

  const removeVariable = (index: number) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index)
    });
  };

  const updateVariable = (index: number, field: string, value: string | boolean) => {
    const newVariables = [...formData.variables];
    newVariables[index] = { ...newVariables[index]!, [field]: value };
    setFormData({ ...formData, variables: newVariables });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">WhatsApp Template Management</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingTemplate(null);
            setFormData(initialFormData);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Configuration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                  Triggers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-6 py-4 w-1/4">
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        ID: {template.template_id}
                      </div>
                      {template.description && (
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {template.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-1/4">
                    <div className="text-sm text-gray-900">
                      <div className="truncate">Project: {template.project_id}</div>
                      <div>Methods: {template.supported_methods.join(', ')}</div>
                      <div>Default: {template.default_method}</div>
                      <div>Variables: {template.variables?.length ?? 0}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 w-1/5">
                    <div className="text-sm text-gray-900">
                      {template.auto_send ? (
                        <div>
                          <div className="text-green-600 font-medium">Auto-send enabled</div>
                          {template.trigger_on_status && template.trigger_on_status.length > 0 && (
                            <div className="text-xs text-gray-500 truncate">
                              On: {template.trigger_on_status.join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-500">Manual only</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-1/6">
                    <button
                      onClick={() => handleToggleStatus(template.id, !template.is_active)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        template.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {template.is_active ? (
                        <>
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 w-1/6 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(template)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit template"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete template"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h2>
                {modalError && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    <strong>Error:</strong> {modalError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Template name (e.g., No Answer Follow-up)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project ID *
                    </label>
                    <input
                      type="text"
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="WhatsApp project identifier"
                    />
                    <p className="text-xs text-gray-500 mt-1">This identifies your WhatsApp template in the API</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={2}
                      placeholder="Template description"
                    />
                  </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workspace ID *
                    </label>
                    <input
                      type="text"
                      value={formData.workspace_id}
                      onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Pre-filled with default</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Channel ID *
                    </label>
                    <input
                      type="text"
                      value={formData.channel_id}
                      onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Pre-filled with default</p>
                  </div>
                </div>

                {/* Variables */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Template Variables</h3>
                    <button
                      onClick={addVariable}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Add Variable
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.variables.map((variable, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Key
                            </label>
                            <input
                              type="text"
                              value={variable.variable_key}
                              onChange={(e) => updateVariable(index, 'variable_key', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                              placeholder="Date"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type
                            </label>
                            <select
                              value={variable.variable_type}
                              onChange={(e) => updateVariable(index, 'variable_type', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Data Source
                            </label>
                            <select
                              value={variable.data_source}
                              onChange={(e) => updateVariable(index, 'data_source', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                            >
                              <option value="">Select source...</option>
                              <optgroup label="Lead Data">
                                {dataSources.lead.map(source => (
                                  <option key={source} value={source}>{source}</option>
                                ))}
                              </optgroup>
                              <optgroup label="User Data">
                                {dataSources.user.map(source => (
                                  <option key={source} value={source}>{source}</option>
                                ))}
                              </optgroup>
                              <optgroup label="System Data">
                                {dataSources.system.map(source => (
                                  <option key={source} value={source}>{source}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Value
                              </label>
                              <input
                                type="text"
                                value={variable.default_value}
                                onChange={(e) => updateVariable(index, 'default_value', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                              />
                            </div>
                            <button
                              onClick={() => removeVariable(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto-trigger Settings */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.auto_send}
                      onChange={(e) => setFormData({ ...formData, auto_send: e.target.checked })}
                      className="mr-2"
                    />
                    Enable auto-send on status change
                  </label>
                  
                  {formData.auto_send && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trigger on these status changes:
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {leadStatuses.map(status => (
                          <label key={status} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.trigger_on_status.includes(status)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    trigger_on_status: [...formData.trigger_on_status, status]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    trigger_on_status: formData.trigger_on_status.filter(s => s !== status)
                                  });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 