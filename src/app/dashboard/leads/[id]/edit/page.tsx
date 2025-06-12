"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchLeadById, updateLead } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { 
  ArrowLeftIcon, 
  UserIcon, 
  HomeIcon, 
  BriefcaseIcon, 
  BanknotesIcon, 
  ChatBubbleLeftEllipsisIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useUserRole } from "../../useUserRole";

type Lead = InferSelectModel<typeof leads>;

// Define field types for better organization
interface BaseField {
  name: keyof Lead;
  label: string;
  type: string;
  disabled?: boolean;
  showIf?: (values: Partial<Lead>) => boolean;
  note?: string | ((values: Partial<Lead>) => string);
}

interface TextField extends BaseField {
  type: 'text' | 'tel' | 'email';
  placeholder?: string;
}

interface SelectField extends BaseField {
  type: 'select';
  options: string[];
}

interface CheckboxField extends BaseField {
  type: 'checkbox';
}

interface CheckboxGroupField extends BaseField {
  type: 'checkbox-group';
  options: string[];
}

type Field = TextField | SelectField | CheckboxField | CheckboxGroupField;

interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: Field[];
  description?: string;
}

// Type guards
const isSelectField = (field: Field): field is SelectField => field.type === 'select';
const isCheckboxField = (field: Field): field is CheckboxField => field.type === 'checkbox';
const isTextField = (field: Field): field is TextField => ['text', 'tel', 'email'].includes(field.type);
const isCheckboxGroupField = (field: Field): field is CheckboxGroupField => field.type === 'checkbox-group';

export default function EditLeadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const leadId = parseInt(params.id);
  const { hasRole } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [originalData, setOriginalData] = useState<Partial<Lead>>({});

  // Load lead data
  useEffect(() => {
    const loadLead = async () => {
      try {
        setLoading(true);
        const result = await fetchLeadById(leadId);
        if (result.success && result.lead) {
          setFormData(result.lead);
          setOriginalData(result.lead);
        } else {
          setError(result.message || "Failed to load lead");
        }
      } catch (err) {
        console.error("Error loading lead:", err);
        setError("An error occurred while loading the lead");
      } finally {
        setLoading(false);
      }
    };

    void loadLead();
  }, [leadId]);
  
  // Define comprehensive sections based on LeadEditSlideOver
  const formSections: Section[] = [
    {
      title: "Personal Information",
      icon: UserIcon,
      description: "Basic contact and identification details",
      fields: [
        { name: "full_name", label: "Full Name", type: "text", placeholder: "Enter full name" } as TextField,
        { name: "email", label: "Email Address", type: "email", placeholder: "example@email.com" } as TextField,
        { name: "phone_number", label: "Primary Phone", type: "tel", placeholder: "+65 XXXX XXXX" } as TextField,
        { name: "phone_number_2", label: "Secondary Phone", type: "tel", placeholder: "+65 XXXX XXXX (optional)" } as TextField,
        { name: "phone_number_3", label: "Additional Phone", type: "tel", placeholder: "+65 XXXX XXXX (optional)" } as TextField,
        { name: "source", label: "Lead Source", type: "text", disabled: true } as TextField,
        { name: "lead_type", label: "Lead Type", type: "select", options: ["new", "reloan"] } as SelectField,
      ]
    },
    {
      title: "Residential Information",
      icon: HomeIcon,
      description: "Residency status and documentation details",
      fields: [
        { 
          name: "residential_status", 
          label: "Residential Status", 
          type: "select",
          options: ["Local", "Foreigner"]
        } as SelectField,
        { 
          name: "has_work_pass_expiry", 
          label: "Work Pass Expiry Date", 
          type: "text",
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "⚠️ Must have at least 6 months validity from today",
          placeholder: "DD/MM/YYYY or text description"
        } as TextField,
        { 
          name: "proof_of_residence_type", 
          label: "Proof of Residence Documents", 
          type: "checkbox-group",
          options: ["Bank Statement", "Utility Bill", "Handphone Bill"],
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "📄 Select all documents available (current or last month)"
        } as CheckboxGroupField,
        { 
          name: "has_proof_of_residence", 
          label: "Has Proof of Residence", 
          type: "checkbox",
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner"
        } as CheckboxField,
        { 
          name: "has_letter_of_consent", 
          label: "Has Letter of Consent", 
          type: "checkbox",
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "📝 Required for LTVP and LTVP+ pass holders only"
        } as CheckboxField,
      ]
    },
    {
      title: "Employment Information",
      icon: BriefcaseIcon,
      description: "Work status, income, and documentation",
      fields: [
        { 
          name: "employment_status", 
          label: "Employment Status", 
          type: "select",
          options: ["Full-Time", "Part-Time", "Self-Employed", "Self-Employed (Platform Worker)", "Unemployed", "UNKNOWN"]
        } as SelectField,
        { 
          name: "employment_salary", 
          label: "Monthly Income", 
          type: "text",
          placeholder: "Enter monthly income amount"
        } as TextField,
        { 
          name: "employment_length", 
          label: "Length of Employment", 
          type: "text",
          showIf: (values: Partial<Lead>) => values.employment_status !== "Unemployed",
          placeholder: "e.g., 2 years 3 months"
        } as TextField,
        {
          name: "has_payslip_3months",
          label: "Has Latest 3 Months Payslips",
          type: "checkbox",
          showIf: (values: Partial<Lead>) => {
            const salary = parseFloat(values.employment_salary?.toString() ?? '0');
            return (
              values.residential_status === "Foreigner" ||
              (values.residential_status === "Local" && (
                (values.employment_status === "Full-Time" && salary >= 7400) ||
                values.employment_status === "Self-Employed" ||
                values.employment_status === "Self-Employed (Platform Worker)"
              ))
            );
          },
          note: (values: Partial<Lead>) => {
            const salary = parseFloat(values.employment_salary?.toString() ?? '0');
            const isHighIncome = values.employment_status === "Full-Time" && salary >= 7400;
            const isSelfEmployed = values.employment_status === "Self-Employed" || values.employment_status === "Self-Employed (Platform Worker)";
            
            let note = "📄 Requirements: Latest 3 months, no payment vouchers, no handwritten payslips";
            
            if (values.residential_status === "Local") {
              if (isHighIncome) {
                note += " • Required for high-income verification (≥ $7,400)";
              } else if (isSelfEmployed) {
                note += " • Required for Self-Employed income verification";
              }
            }
            
            return note;
          }
        } as CheckboxField,
      ]
    },
    {
      title: "Loan Information",
      icon: BanknotesIcon,
      description: "Loan requirements and existing obligations",
      fields: [
        { 
          name: "amount", 
          label: "Requested Loan Amount", 
          type: "text",
          placeholder: "Enter requested amount"
        } as TextField,
        { 
          name: "loan_purpose", 
          label: "Purpose of Loan", 
          type: "text",
          placeholder: "Describe the purpose of the loan"
        } as TextField,
        { 
          name: "existing_loans", 
          label: "Has Existing Loans", 
          type: "select", 
          options: ["Yes", "No", "UNKNOWN"] 
        } as SelectField,
        { 
          name: "outstanding_loan_amount", 
          label: "Outstanding Loan Amount", 
          type: "text",
          showIf: (values: Partial<Lead>) => values.existing_loans === "Yes",
          placeholder: "Total outstanding amount"
        } as TextField,
      ]
    },
    {
      title: "Communication Preferences",
      icon: ChatBubbleLeftEllipsisIcon,
      description: "How the customer prefers to be contacted",
      fields: [
        { 
          name: "contact_preference", 
          label: "Preferred Contact Method", 
          type: "select",
          options: ["No Preferences", "WhatsApp", "Call", "SMS", "Email"]
        } as SelectField,
        { 
          name: "communication_language", 
          label: "Preferred Language", 
          type: "select",
          options: ["No Preferences", "English", "Mandarin", "Malay", "Tamil", "Others"]
        } as SelectField,
        // { 
        //   name: "is_contactable", 
        //   label: "Is Contactable", 
        //   type: "checkbox"
        // } as CheckboxField,
      ]
    },
  ];

  // Add status section for admin users
  if (hasRole('admin')) {
    formSections.push({
      title: "Lead Management",
      icon: ExclamationTriangleIcon,
      description: "Status and assignment information (Admin only)",
      fields: [
        { 
          name: "status", 
          label: "Lead Status", 
          type: "select",
          options: ["new", "assigned", "no_answer", "follow_up", "booked", "done", "missed/RS", "unqualified", "give_up", "blacklisted"]
        } as SelectField,
        { 
          name: "assigned_to", 
          label: "Assigned To", 
          type: "text",
          placeholder: "Agent ID or name"
        } as TextField,
        { 
          name: "lead_score", 
          label: "Lead Score", 
          type: "text",
          placeholder: "0-100"
        } as TextField,
        { 
          name: "eligibility_status", 
          label: "Eligibility Status", 
          type: "select",
          options: ["eligible", "ineligible", "pending", "duplicate", "error"]
        } as SelectField,
        { 
          name: "eligibility_notes", 
          label: "Eligibility Notes", 
          type: "text",
          placeholder: "Additional notes about eligibility"
        } as TextField,
      ]
    });
  }

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  // Handle checkbox group changes
  const handleCheckboxGroupChange = (fieldName: string, option: string, isChecked: boolean) => {
    const currentValue = formData[fieldName as keyof Lead] as string || '';
    const currentValues = currentValue ? currentValue.split(', ').filter(Boolean) : [];
    
    const newValues = isChecked
      ? [...currentValues, option]
      : currentValues.filter(val => val !== option);
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: newValues.join(', ')
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    
    try {
      const result = await updateLead(leadId, formData);
      
      if (result.success) {
        setSuccess('Lead updated successfully!');
        setOriginalData(formData);
        // Auto-redirect after 2 seconds
        setTimeout(() => {
        router.push(`/dashboard/leads/${leadId}`);
        }, 2000);
      } else {
        setError(result.message || 'Failed to update lead');
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      setError('An error occurred while updating the lead');
    } finally {
      setSaving(false);
    }
  };

  // Check if form has changes
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  // Render field based on type
  const renderField = (field: Field) => {
    const shouldShow = !field.showIf || field.showIf(formData);
    if (!shouldShow) return null;

    const fieldId = `field-${field.name}`;
    const fieldValue = formData[field.name];

    if (isSelectField(field)) {
      return (
        <div key={field.name} className="space-y-2">
          <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
            {field.label}
          </label>
          <select
            id={fieldId}
            name={field.name}
            value={fieldValue?.toString() ?? ''}
            onChange={handleChange}
            disabled={field.disabled}
            className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              field.disabled 
                ? 'bg-gray-50 border-gray-200 text-gray-500' 
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <option value="">Select an option...</option>
            {field.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {field.note && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              {typeof field.note === 'function' ? field.note(formData) : field.note}
            </p>
          )}
        </div>
      );
    }

    if (isCheckboxField(field)) {
      return (
        <div key={field.name} className="space-y-2">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id={fieldId}
              name={field.name}
              checked={!!fieldValue}
              onChange={handleChange}
              disabled={field.disabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor={fieldId} className="text-sm font-medium text-gray-700">
              {field.label}
            </label>
          </div>
          {field.note && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded ml-7">
              {typeof field.note === 'function' ? field.note(formData) : field.note}
            </p>
          )}
        </div>
      );
    }

    if (isCheckboxGroupField(field)) {
      const currentValues = fieldValue ? (fieldValue as string).split(', ').filter(Boolean) : [];
      
      return (
        <div key={field.name} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
          </label>
          <div className="space-y-2">
            {field.options.map((option) => (
              <div key={option} className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id={`${fieldId}-${option}`}
                  checked={currentValues.includes(option)}
                  onChange={(e) => handleCheckboxGroupChange(field.name, option, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`${fieldId}-${option}`} className="text-sm text-gray-700">
                  {option}
                </label>
              </div>
            ))}
          </div>
          {field.note && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              {typeof field.note === 'function' ? field.note(formData) : field.note}
            </p>
          )}
        </div>
      );
    }

    if (isTextField(field)) {
      return (
        <div key={field.name} className="space-y-2">
          <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
            {field.label}
          </label>
          <input
            type={field.type}
            id={fieldId}
            name={field.name}
            value={fieldValue?.toString() ?? ''}
            onChange={handleChange}
            disabled={field.disabled}
            placeholder={field.placeholder}
            className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              field.disabled 
                ? 'bg-gray-50 border-gray-200 text-gray-500' 
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          />
          {field.note && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              {typeof field.note === 'function' ? field.note(formData) : field.note}
            </p>
          )}
        </div>
      );
    }

    return null;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error && !formData.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading lead</p>
            <p className="text-red-600 mt-2">{error}</p>
        <button
              onClick={() => router.push('/dashboard/leads')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Back to Leads
        </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/dashboard/leads/${leadId}`)}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Lead
            </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Lead</h1>
                <p className="text-sm text-gray-500">{formData.full_name || 'Unnamed Lead'}</p>
          </div>
        </div>
        
            {hasChanges && (
              <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span>Unsaved changes</span>
                  </div>
                  )}
                </div>
                  </div>
                </div>

      {/* Form */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                <p className="text-green-800">{success}</p>
              </div>
                </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
                  </div>
          )}

          {/* Form Sections */}
          {formSections.map((section) => (
            <div key={section.title} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <section.icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{section.title}</h2>
                    {section.description && (
                      <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map(renderField)}
                </div>
              </div>
            </div>
          ))}

          {/* Form Actions */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
            <div className="text-sm text-gray-500">
              {hasChanges ? 'You have unsaved changes' : 'No changes made'}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/leads/${leadId}`)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
            </div>
          </form>
      </div>
    </div>
  );
} 