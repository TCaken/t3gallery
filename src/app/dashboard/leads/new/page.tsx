"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLead } from '~/app/_actions/leadActions';
import { 
  UserIcon, 
  HomeIcon, 
  BriefcaseIcon, 
  CurrencyDollarIcon, 
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Define field types
interface BaseField {
  name: string;
  label: string;
  type: string;
  disabled?: boolean;
  showIf?: (values: Record<string, any>) => boolean;
  note?: string | ((values: Record<string, any>) => string);
  required?: boolean;
}

interface TextField extends BaseField {
  type: 'text' | 'tel' | 'email';
}

interface SelectField extends BaseField {
  type: 'select';
  options: string[];
}

interface CheckboxField extends BaseField {
  type: 'checkbox';
}

interface RadioField extends BaseField {
  type: 'radio';
  options: string[];
}

interface CheckboxGroupField extends BaseField {
  type: 'checkbox-group';
  options: string[];
}

type Field = TextField | SelectField | CheckboxField | RadioField | CheckboxGroupField;

interface Section {
  title: string;
  description?: string;
  fields: Field[];
  icon?: React.ComponentType<{ className?: string }>;
}

// Type guard functions
const isSelectField = (field: Field): field is SelectField => field.type === 'select';
const isCheckboxField = (field: Field): field is CheckboxField => field.type === 'checkbox';
const isTextField = (field: Field): field is TextField => field.type === 'text' || field.type === 'tel' || field.type === 'email';
const isRadioField = (field: Field): field is RadioField => field.type === 'radio';
const isCheckboxGroupField = (field: Field): field is CheckboxGroupField => field.type === 'checkbox-group';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [formData, setFormData] = useState<Record<string, any>>({
    source: 'Crawfort',
    full_name: '',
    email: '',
    phone_number: '',
    phone_number_2: '',
    phone_number_3: '',
    residential_status: '',
    has_work_pass_expiry: '',
    proof_of_residence_type: '',
    has_letter_of_consent: false,
    employment_status: '',
    employment_salary: '',
    employment_length: '',
    has_payslip_3months: false,
    amount: '',
    loan_purpose: '',
    existing_loans: '',
    outstanding_loan_amount: '',
    contact_preference: 'No Preferences',
    communication_language: 'No Preferences'
  });

  // Form sections based on LeadEditSlideOver structure
  const formSections: Section[] = [
    {
      title: "Lead Information",
      description: "Basic contact and source information",
      icon: UserIcon,
      fields: [
        { 
          name: "source", 
          label: "Lead Source", 
          type: "select", 
          required: true,
          options: [
            "Crawfort",
            "Loanable",
            "1% Loan",
            "OMY.sg",
            "MoneyRight",
            "SEO",
            "Lendela",
            "LendingPoint",
            "MoneyIQ",
            "Firebase",
            "Other"
          ]
        } as SelectField,
        { name: "full_name", label: "Full Name", type: "text", required: true } as TextField,
        { name: "email", label: "Email", type: "email" } as TextField,
        { name: "phone_number", label: "Primary Phone", type: "tel", required: true } as TextField,
        { name: "phone_number_2", label: "Secondary Phone", type: "tel" } as TextField,
        { name: "phone_number_3", label: "Additional Phone", type: "tel" } as TextField,
      ]
    },
    {
      title: "Residential Information",
      description: "Residency status and documentation",
      icon: HomeIcon,
      fields: [
        { 
          name: "residential_status", 
          label: "Are you a local or foreigner?", 
          type: "radio",
          options: ["Local", "Foreigner"],
          note: "Please select your residency status",
          required: true
        } as RadioField,
        { 
          name: "has_work_pass_expiry", 
          label: "When does your work pass expire?", 
          type: "text",
          showIf: (values) => values.residential_status === "Foreigner",
          note: "⚠️ Must have at least 6 months validity from today (DD/MM/YYYY format)"
        } as TextField,
        { 
          name: "proof_of_residence_type", 
          label: "Proof of Residence Documents", 
          type: "checkbox-group",
          options: ["Bank Statement", "Utility Bill", "Handphone Bill"],
          showIf: (values) => values.residential_status === "Foreigner",
          note: "📄 Select all documents you can provide:\n\n⚠️ Important: From 6th of the Month onwards, must provide current month statement"
        } as CheckboxGroupField,
        { 
          name: "has_letter_of_consent", 
          label: "Has Letter of Consent", 
          type: "checkbox",
          showIf: (values) => values.residential_status === "Foreigner",
          note: "📝 Required for LTVP and LTVP+ pass holders only"
        } as CheckboxField
      ]
    },
    {
      title: "Employment Information",
      description: "Work status and income details",
      icon: BriefcaseIcon,
      fields: [
        { 
          name: "employment_status", 
          label: "Employment Status", 
          type: "select",
          options: ["Full-Time", "Part-Time", "Self-Employed", "Self-Employed (Platform Worker)", "Unemployed", "UNKNOWN"],
          required: true
        } as SelectField,
        { 
          name: "employment_salary", 
          label: "Monthly Income", 
          type: "text",
          required: true
        } as TextField,
        { 
          name: "employment_length", 
          label: "Length of Employment", 
          type: "text",
          showIf: (values) => values.employment_status !== "Unemployed"
        } as TextField,
        {
          name: "has_payslip_3months",
          label: "Has Latest 3 Months Payslips",
          type: "checkbox",
          showIf: (values) => {
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
          note: (values) => {
            const salary = parseFloat(values.employment_salary?.toString() ?? '0');
            const isHighIncome = values.employment_status === "Full-Time" && salary >= 7400;
            const isSelfEmployed = values.employment_status === "Self-Employed" || values.employment_status === "Self-Employed (Platform Worker)";
            
            let note = "📄 Requirements:\n• Must be latest 3 months\n• No payment vouchers\n• No handwritten payslips\n\n⚠️ From 6th of the month onwards, must include last month's payslip";
            
            if (values.residential_status === "Local") {
              if (isHighIncome) {
                note += "\n💡 Required for high-income verification (>= $7,400)";
              } else if (isSelfEmployed) {
                note += "\n💡 Required for Self-Employed and Platform Workers income verification";
              }
            }
            
            return note;
          }
        } as CheckboxField
      ]
    },
    {
      title: "Loan Information",
      description: "Loan requirements and existing obligations",
      icon: CurrencyDollarIcon,
      fields: [
        { 
          name: "amount", 
          label: "Requested Loan Amount", 
          type: "text",
          required: true
        } as TextField,
        { 
          name: "loan_purpose", 
          label: "Purpose of Loan", 
          type: "text",
          required: true
        } as TextField,
        { 
          name: "existing_loans", 
          label: "Has Existing Loans", 
          type: "select", 
          options: ["Yes", "No", "UNKNOWN"],
          required: true
        } as SelectField,
        { 
          name: "outstanding_loan_amount", 
          label: "Outstanding Loan Amount", 
          type: "text",
          showIf: (values) => values.existing_loans === "Yes"
        } as TextField
      ]
    },
    {
      title: "Communication Preferences",
      description: "How you prefer to be contacted",
      icon: ChatBubbleLeftRightIcon,
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
        } as SelectField
      ]
    }
  ];

  // Validation functions
  const validateSGPhoneNumber = (phone: string) => {
    if (!phone) return false;
    const cleaned = phone.replace(/\s+|-|\(|\)/g, '');
    if (cleaned.startsWith('+65')) {
      return /^\+65[896]\d{7}$/.test(cleaned);
    }
    if (cleaned.startsWith('65')) {
      return /^65[896]\d{7}$/.test(cleaned);
    }
    return /^[896]\d{7}$/.test(cleaned);
  };

  const formatSGPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.includes('+')) {
      if (cleaned.startsWith('65')) {
        return `+${cleaned}`;
      }
      return `+65${cleaned}`;
    }
    return cleaned;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Check required fields
    formSections.forEach(section => {
      section.fields.forEach(field => {
        if (field.required) {
          const shouldShow = !field.showIf || field.showIf(formData);
          if (shouldShow && (!formData[field.name] || formData[field.name] === '')) {
            newErrors[field.name] = `${field.label} is required`;
          }
        }
      });
    });

    // Validate phone number
    if (formData.phone_number && !validateSGPhoneNumber(formData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid Singapore phone number';
    }

    // Validate email
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setNotification({ message: 'Please fix the errors below', type: 'error' });
      return;
    }

    setLoading(true);
    setNotification(null);

    try {
      // Format phone numbers
      const formattedData = {
        ...formData,
        phone_number: formatSGPhoneNumber(formData.phone_number),
        phone_number_2: formData.phone_number_2 ? formatSGPhoneNumber(formData.phone_number_2) : '',
        phone_number_3: formData.phone_number_3 ? formatSGPhoneNumber(formData.phone_number_3) : '',
      };

      const result = await createLead(formattedData);
      
      if (result.success) {
        setNotification({ message: 'Lead created successfully!', type: 'success' });
        setTimeout(() => {
          router.push('/dashboard/leads');
        }, 1500);
      } else {
        setNotification({ message: `Failed to create lead: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      setNotification({ message: 'An error occurred while creating the lead', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: Field) => {
    const shouldShow = !field.showIf || field.showIf(formData);
    if (!shouldShow) return null;

    const hasError = !!errors[field.name];
    const fieldValue = formData[field.name] ?? '';

    if (isSelectField(field)) {
      return (
        <div className="space-y-1">
          <select
            id={field.name}
            name={field.name}
            value={fieldValue.toString()}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none ${
              hasError 
                ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-gray-300 bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
            }`}
          >
            <option value="">Select an option...</option>
            {field.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    if (isRadioField(field)) {
      return (
        <div className="space-y-2">
          {field.options.map((option: string) => (
            <label key={option} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={field.name}
                value={option}
                checked={fieldValue === option}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (isCheckboxGroupField(field)) {
      const currentValues: string[] = fieldValue ? fieldValue.split(',').map((v: string) => v.trim()).filter(Boolean) : [];

      return (
        <div className="space-y-2">
          {field.options.map((option: string) => (
            <label key={option} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentValues.includes(option)}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  const newValues = isChecked
                    ? [...currentValues, option]
                    : currentValues.filter(val => val !== option);
                  
                  handleFieldChange(field.name, newValues.join(', '));
                }}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (isCheckboxField(field)) {
      return (
        <div className="space-y-1">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!fieldValue}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 focus:ring-offset-0"
            />
            <span className="text-sm text-gray-700">Yes, I confirm this</span>
          </label>
        </div>
      );
    }

    if (isTextField(field)) {
      return (
        <div className="space-y-1">
          {field.type === 'tel' ? (
            <div className={`flex rounded-md border shadow-sm transition-colors ${
              hasError 
                ? 'border-red-300 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500'
                : 'border-gray-300 bg-white focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500'
            }`}>
              <span className="inline-flex items-center px-3 rounded-l-md border-r border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +65
              </span>
              <input
                type="tel"
                id={field.name}
                name={field.name}
                value={fieldValue.toString().replace(/^\+?65/, '')}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="flex-1 rounded-r-md px-3 py-2 text-sm focus:outline-none bg-transparent"
                placeholder="81234567"
              />
            </div>
          ) : (
            <input
              type={field.type}
              id={field.name}
              name={field.name}
              value={fieldValue.toString()}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none ${
                hasError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-gray-300 bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
              }`}
              placeholder={field.type === 'email' ? 'example@email.com' : 'Enter your answer...'}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors duration-200"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Add New Lead</h1>
              <p className="text-sm text-gray-600">Fill in the lead information below</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className={`rounded-md p-3 flex items-center space-x-2 ${
            notification.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {formSections.map((section, index) => (
            <div key={section.title} className="bg-white border border-gray-200 rounded-lg">
              {/* Section Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center space-x-3">
                  {section.icon && (
                    <div className="p-2 bg-gray-100 rounded-md">
                      <section.icon className="h-5 w-5 text-gray-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                    {section.description && (
                      <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map((field) => {
                    const shouldShow = !field.showIf || field.showIf(formData);
                    if (!shouldShow) return null;

                    return (
                      <div key={field.name} className="space-y-2">
                        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        
                        {field.note && (
                          <div className="bg-gray-50 border-l-4 border-gray-300 p-3 rounded-r-md">
                            <div className="text-xs text-gray-600 whitespace-pre-line">
                              {typeof field.note === 'function' ? field.note(formData) : field.note}
                            </div>
                          </div>
                        )}
                        
                        {renderField(field)}
                        
                        {errors[field.name] && (
                          <p className="text-sm text-red-600">{errors[field.name]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Submit Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{loading ? 'Creating Lead...' : 'Create Lead'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}