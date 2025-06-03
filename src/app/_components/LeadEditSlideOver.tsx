import { Fragment, useMemo, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from "~/server/db/schema";

type Lead = InferSelectModel<typeof leads>;

// Define field types with proper typing
interface BaseField {
  name: keyof Lead;
  label: string;
  type: string;
  disabled?: boolean;
  showIf?: (values: Partial<Lead>) => boolean;
  note?: string | ((values: Partial<Lead>) => string);
}

interface TextField extends BaseField {
  type: 'text' | 'tel';
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
  fields: Field[];
  icon?: React.ComponentType<{ className?: string }>;
}

// Type guard functions
const isSelectField = (field: Field): field is SelectField => {
  return field.type === 'select';
};

const isCheckboxField = (field: Field): field is CheckboxField => {
  return field.type === 'checkbox';
};

const isTextField = (field: Field): field is TextField => {
  return field.type === 'text' || field.type === 'tel';
};

const isRadioField = (field: Field): field is RadioField => {
  return field.type === 'radio';
};

const isCheckboxGroupField = (field: Field): field is CheckboxGroupField => {
  return field.type === 'checkbox-group';
};

interface EditableFields {
  source: boolean;
  full_name: boolean;
  phone_number: boolean;
  phone_number_2: boolean;
  phone_number_3: boolean;
  email: boolean;
  residential_status?: boolean;
  employment_status?: boolean;
  employment_salary?: boolean;
  employment_length?: boolean;
  has_proof_of_residence?: boolean;
  has_letter_of_consent?: boolean;
  loan_purpose?: boolean;
  existing_loans?: boolean;
  outstanding_loan_amount?: boolean;
  contact_preference?: boolean;
  communication_language?: boolean;
  follow_up_date?: boolean;
  amount?: boolean;
  status?: boolean;
  lead_type?: boolean;
}

interface FormValues extends Partial<Lead> {
  follow_up_date?: Date | null;
  follow_up_time?: string;
  proof_of_residence_documents?: string[];
  [key: string]: string | boolean | Date | number | null | undefined | string[];
}

interface LeadEditSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSave: (updatedLead: Partial<Lead>) => Promise<void>;
}

export default function LeadEditSlideOver({ isOpen, onClose, lead, onSave }: LeadEditSlideOverProps) {
  const [selectedAction, setSelectedAction] = useState<string>('save');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpTime, setFollowUpTime] = useState<string>('00:00');
  const [formValues, setFormValues] = useState<FormValues>({
    ...lead,
    follow_up_time: '00:00'
  });
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues>(lead);
  const [currentStep, setCurrentStep] = useState(0);

  // console.log("LeadEditSlideOver", lead);
  
  // Reset form and initial values when lead changes
  useEffect(() => {
    const newValues = {
      ...lead,
      follow_up_time: '00:00'
    };
    setFormValues(newValues);
    setInitialValues(newValues);
    setHasUnsavedChanges(false);
    setCurrentStep(0);
  }, [lead]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = Object.keys(formValues).some(key => {
      // Skip checking follow_up_time as it's a UI-only field
      if (key === 'follow_up_time') return false;
      
      const initialValue = initialValues[key];
      const currentValue = formValues[key];
      
      // Handle date comparison
      if (initialValue instanceof Date && currentValue instanceof Date) {
        return initialValue.getTime() !== currentValue.getTime();
      }
      
      return initialValue !== currentValue;
    });
    
    setHasUnsavedChanges(hasChanges);
  }, [formValues, initialValues]);

  // Get confirmation message based on action
  const getConfirmationMessage = (action: string) => {
    switch (action) {
      case 'follow_up':
        return 'Please select a follow-up date. The lead will be scheduled for follow-up on the selected date.';
      case 'no_answer':
        return 'The lead will be marked as "No Answer" and will stay in this state for 14 days before requiring action.';
      case 'give_up':
        return 'Are you sure you want to give up on this lead? This action can be reversed later if needed.';
      case 'blacklist':
        return 'Warning: Blacklisting this lead will permanently remove them from active leads. This action cannot be undone.';
      default:
        return '';
    }
  };

  // Get default follow-up date (today at 00:00 Singapore time)
  const getDefaultFollowUpDate = () => {
    const now = new Date();
    // Create date string in Singapore timezone
    const sgDate = new Date(now.getTime());
    sgDate.setHours(0, 0, 0, 0);
    return sgDate.toISOString().slice(0, 16);
  };

  // Get max follow-up date (30 days from now at 00:00 Singapore time)
  const getMaxFollowUpDate = () => {
    const now = new Date();
    const maxDate = new Date(now.getTime());
    maxDate.setDate(maxDate.getDate() + 30);
    maxDate.setHours(0, 0, 0, 0);
    return maxDate.toISOString().split('T')[0];
  };

  // Format date for display (Singapore timezone)
  const formatDateForDisplay = (date: string) => {
    // Parse the UTC date and format it in Singapore time
    const utcDate = new Date(date);
    return utcDate.toLocaleString('en-SG', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Singapore'
    });
  };

  // Handle action button click
  const handleActionClick = (action: string) => {
    setSelectedAction(action);
    if (action === 'follow_up') {
      setFollowUpDate(getDefaultFollowUpDate());
    }
    setShowConfirmationModal(true);
  };

  // Handle confirmed action
  const handleConfirmedAction = async () => {
    setShowConfirmationModal(false);
    
    if (selectedAction === 'follow_up' && followUpDate) {
      // Combine date and time, defaulting to 00:00 if no time selected
      const dateStr = followUpDate.split('T')[0];
      const timeStr = followUpTime || '00:00';
      
      // Create date in Singapore timezone
      const sgDate = new Date(`${dateStr}T${timeStr}:00+08:00`);
      
      // Convert to UTC for database storage
      const utcDate = new Date(sgDate.getTime());
      
      // Update form values with the follow-up date
      const updatedValues = {
        ...formValues,
        status: 'follow_up',
        follow_up_date: utcDate
      };
      setFormValues(updatedValues);
      
      // Save the lead with updated status and follow-up date
      await onSave(updatedValues);
      onClose();
      return;
    }
    
    await handleSubmit(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | null) => {
    if (e) {
      e.preventDefault();
    }

    const formElement = e?.currentTarget ?? document.querySelector('form');
    if (!formElement) return;

    const formData = new FormData(formElement);
    const updatedLead: FormValues = {};

    // Add all form fields to updatedLead
    questionnaireSections.forEach((section: Section) => {
      section.fields.forEach((field: Field) => {
        const value = formData.get(field.name.toString());
        
        // Skip if value is null or empty string for optional fields
        if (value === null || value === '') return;

        const fieldName = field.name.toString();
        if (isCheckboxField(field)) {
          updatedLead[fieldName] = value === 'on';
        } else if (typeof value === 'string') {
          updatedLead[fieldName] = value;
        }
      });
    });

    // Merge with existing form values to keep any fields not in the form
    const finalValues = {
      ...formValues,
      ...updatedLead
    };

    // Handle different actions
    switch (selectedAction) {
      case 'no_answer':
        finalValues.status = 'no_answer';
        finalValues.follow_up_date = null;
        break;
      case 'give_up':
        finalValues.status = 'give_up';
        finalValues.follow_up_date = null;
        break;
      case 'blacklist':
        finalValues.status = 'blacklisted';
        finalValues.follow_up_date = null;
        break;
    }

    await onSave(finalValues);
    onClose();
  };

  // Handle closing attempt
  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesModal(true);
    } else {
      onClose();
    }
  };

  // Handle confirmed close
  const handleConfirmedClose = () => {
    setShowUnsavedChangesModal(false);
    // Reset form values to initial state
    setFormValues(initialValues);
    setHasUnsavedChanges(false);
    onClose();
  };

  // Handle cancel close
  const handleCancelClose = () => {
    setShowUnsavedChangesModal(false);
  };

  // Handle form field changes
  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormValues(prev => ({
      ...prev,
      [name]: newValue
    }));
    // console.log("formValues", name, formValues[name as keyof Lead], newValue);
  };

  // Determine if we're in questionnaire mode by comparing dates up to the minute level
  const formatToMinute = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
  };

  const createdDate = new Date(lead.created_at);
  const updatedDate = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
  
  const isQuestionnaireMode = formatToMinute(createdDate) === formatToMinute(updatedDate);
  const questionnaireSections = useMemo(() => createQuestionnaireSections(isQuestionnaireMode), [isQuestionnaireMode]);

  // Handle booking action
  const handleBooking = async () => {
    try {
      // First save any changes
      if (hasUnsavedChanges) {
        const updatedValues = {
          ...formValues
        };
        await onSave(updatedValues);
      }
      
      // Close the modal
      onClose();
      
      // Open booking page in new tab
      if (lead.id) {
        window.open(`leads/${lead.id}/appointment`, '_blank');
      }
    } catch (error) {
      console.error('Error during booking:', error);
      // Optionally add error handling UI here
    }
  };

  // Action buttons configuration
  const actionButtons = [
    {
      id: 'save',
      label: 'Save Changes',
      color: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'book',
      label: 'Book Appointment',
      color: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      textColor: 'text-white',
      icon: CalendarIcon,
      enabled: true,
      onClick: handleBooking
    },
    {
      id: 'follow_up',
      label: 'Schedule Follow-up',
      color: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'no_answer',
      label: 'No Answer',
      color: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'give_up',
      label: 'Give Up',
      color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'blacklist',
      label: 'Blacklist',
      color: 'bg-black hover:bg-gray-900 focus:ring-gray-500',
      textColor: 'text-white',
      enabled: true
    }
  ];

  // Navigation functions for multi-step
  const nextStep = () => {
    if (currentStep < questionnaireSections.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderField = (field: Field) => {
    if (isSelectField(field)) {
      return (
        <div className="space-y-2">
          <select
            id={field.name.toString()}
            name={field.name.toString()}
            value={formValues[field.name]?.toString() ?? ''}
            onChange={handleFieldChange}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-gray-300"
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
        <div className="space-y-3">
          {field.options.map((option: string) => (
            <label key={option} className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="radio"
                  id={`${field.name}-${option}`}
                  name={field.name.toString()}
                  value={option}
                  checked={formValues[field.name] === option}
                  onChange={handleFieldChange}
                  className="h-5 w-5 border-2 border-gray-300 text-blue-600 transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:ring-offset-0 group-hover:border-blue-400"
                />
              </div>
              <span className="text-base text-gray-700 leading-relaxed">
                {option}
              </span>
            </label>
          ))}
        </div>
      );
    }

    if (isCheckboxGroupField(field)) {
      // Handle checkbox group fields - store as comma-separated string in existing fields
      let currentValues: string[] = [];
      const fieldValue = formValues[field.name];
      
      if (typeof fieldValue === 'string' && fieldValue) {
        currentValues = fieldValue.split(',').map(v => v.trim()).filter(Boolean);
      }

      return (
        <div className="space-y-3">
          {field.options.map((option: string) => (
            <label key={option} className="flex items-start space-x-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  id={`${field.name}-${option}`}
                  name={`${field.name}-${option}`}
                  checked={currentValues.includes(option)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    const newValues = isChecked
                      ? [...currentValues, option]
                      : currentValues.filter(val => val !== option);
                    
                    setFormValues(prev => ({
                      ...prev,
                      [field.name]: newValues.join(', ')
                    }));
                  }}
                  className="h-5 w-5 rounded-lg border-2 border-gray-300 text-blue-600 transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:ring-offset-0 group-hover:border-blue-400"
                />
                {currentValues.includes(option) && (
                  <CheckCircleIcon className="absolute -top-0.5 -left-0.5 h-6 w-6 text-blue-600 pointer-events-none" />
                )}
              </div>
              <span className="text-base text-gray-700 leading-relaxed">
                {option}
              </span>
            </label>
          ))}
        </div>
      );
    }

    if (isCheckboxField(field)) {
      // Special handling for residential_status field (now handled by radio buttons)
      if (field.name === 'residential_status') {
        return null; // This field is now handled as radio buttons
      }
      
      // Regular checkbox handling for other fields
      return (
        <div className="space-y-2">
          <label className="flex items-start space-x-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                id={field.name.toString()}
                name={field.name.toString()}
                checked={!!formValues[field.name]}
                onChange={handleFieldChange}
                className="h-5 w-5 rounded-lg border-2 border-gray-300 text-blue-600 transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:ring-offset-0 group-hover:border-blue-400"
              />
              {formValues[field.name] && (
                <CheckCircleIcon className="absolute -top-0.5 -left-0.5 h-6 w-6 text-blue-600 pointer-events-none" />
              )}
            </div>
            <span className="text-base text-gray-700 leading-relaxed">
              Yes, I confirm this
            </span>
          </label>
        </div>
      );
    }

    if (isTextField(field)) {
      return (
        <div className="space-y-2">
          <input
            type={field.type}
            id={field.name.toString()}
            name={field.name.toString()}
            value={formValues[field.name]?.toString() ?? ''}
            onChange={handleFieldChange}
            disabled={field.disabled}
            className={`w-full rounded-xl border-2 px-4 py-3 text-base shadow-sm transition-all duration-200 focus:outline-none ${
              field.disabled 
                ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'
            }`}
            placeholder={field.type === 'tel' ? '+65 XXXX XXXX' : 'Enter your answer...'}
          />
        </div>
      );
    }

    return null;
  };

  const currentSection = questionnaireSections[currentStep];
  const progress = ((currentStep + 1) / questionnaireSections.length) * 100;

  // Add this new function to create lead details sections
  const createLeadDetailsSections = (): Section[] => [
    {
      title: "Lead Information",
      icon: QuestionMarkCircleIcon,
      fields: [
        { name: "source", label: "Lead Source", type: "text", disabled: true } as TextField,
        { name: "full_name", label: "Full Name", type: "text" } as TextField,
        { name: "email", label: "Email", type: "text" } as TextField,
        { name: "phone_number", label: "Primary Phone", type: "tel", disabled: true } as TextField,
        { name: "phone_number_2", label: "Secondary Phone", type: "tel" } as TextField,
        { name: "phone_number_3", label: "Additional Phone", type: "tel" } as TextField,
      ]
    },
    {
      title: "Residential Information",
      icon: QuestionMarkCircleIcon,
      fields: [
        { 
          name: "residential_status", 
          label: "Are you a local or foreigner?", 
          type: "radio",
          options: ["Local", "Foreigner"],
          note: "Please select your residency status"
        } as RadioField,
        { 
          name: "has_work_pass_expiry", 
          label: "When does your work pass expire?", 
          type: "text",
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "⚠️ Must have at least 6 months validity from today (DD/MM/YYYY format)"
        } as TextField,
        { 
          name: "proof_of_residence_type", 
          label: "Proof of Residence Documents", 
          type: "checkbox-group",
          options: ["Bank Statement", "Utility Bill", "Handphone Bill"],
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "📄 Select all documents you can provide:\n\n⚠️ Important: From 6th of the Month onwards, must provide current month statement"
        } as CheckboxGroupField,
        { 
          name: "has_letter_of_consent", 
          label: "Has Letter of Consent", 
          type: "checkbox",
          showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
          note: "📝 Required for LTVP and LTVP+ pass holders only"
        } as CheckboxField
      ]
    },
    {
      title: "Employment Information",
      icon: QuestionMarkCircleIcon,
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
          type: "text"
        } as TextField,
        { 
          name: "employment_length", 
          label: "Length of Employment", 
          type: "text",
          showIf: (values: Partial<Lead>) => values.employment_status !== "Unemployed"
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
      icon: QuestionMarkCircleIcon,
      fields: [
        { 
          name: "amount", 
          label: "Requested Loan Amount", 
          type: "text" 
        } as TextField,
        { 
          name: "loan_purpose", 
          label: "Purpose of Loan", 
          type: "text" 
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
          showIf: (values: Partial<Lead>) => values.existing_loans === "Yes"
        } as TextField
      ]
    },
    {
      title: "Communication Preferences",
      icon: QuestionMarkCircleIcon,
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

  return (
    <>
    <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseAttempt}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-6 lg:pl-8">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-out duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto relative w-screen max-w-2xl">
                    <div className="flex h-full flex-col bg-white shadow-2xl">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <Dialog.Title className="text-xl font-semibold">
                            {isQuestionnaireMode ? "Lead Questionnaire" : "Edit Lead"}
                          </Dialog.Title>
                            <p className="mt-1 text-blue-100 text-sm">
                            {isQuestionnaireMode 
                                ? "Help us understand your requirements better" 
                              : "Update lead information and status"}
                          </p>
                        </div>
                          <button
                            type="button"
                          className="rounded-lg p-2 text-blue-100 hover:bg-blue-600 hover:text-white transition-colors duration-200"
                            onClick={handleCloseAttempt}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                      </div>
                      
                      {/* Progress Bar - Only show in questionnaire mode */}
                      {isQuestionnaireMode && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm text-blue-100 mb-2">
                            <span>Step {currentStep + 1} of {questionnaireSections.length}</span>
                            <span>{Math.round(progress)}% complete</span>
                          </div>
                          <div className="w-full bg-blue-500/30 rounded-full h-2">
                            <div 
                              className="bg-white rounded-full h-2 transition-all duration-500 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                        </div>
                      </div>
                      )}
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="h-full flex flex-col">
                        <div className="flex-1 px-6 py-8">
                          {isQuestionnaireMode ? (
                            // Questionnaire View
                            currentSection && (
                              <div className="space-y-8">
                                <div className="text-center">
                                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                    {currentSection.title}
                                  </h2>
                                  <div className="w-16 h-1 bg-blue-600 mx-auto rounded-full"></div>
                                </div>

                                <div className="space-y-8 max-w-lg mx-auto">
                                  {currentSection.fields.map((field) => {
                                    const shouldShow = !field.showIf || field.showIf(formValues);
                                    if (!shouldShow) return null;

                                    return (
                                      <div key={field.name} className="space-y-3">
                                        <label htmlFor={field.name} className="block text-lg font-medium text-gray-900 leading-relaxed">
                                          {field.label}
                                        </label>
                                        {field.note && (
                                          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                                            <div className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">
                                              {typeof field.note === 'function' ? field.note(formValues) : field.note}
                                            </div>
                                          </div>
                                        )}
                                        {renderField(field)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          ) : (
                            // Lead Details View
                            <div className="max-w-4xl mx-auto">
                              {createLeadDetailsSections().map((section, sectionIndex) => (
                                <div key={section.title} className="mb-8 last:mb-0">
                                  <div className="flex items-center space-x-3 mb-6">
                                    {section.icon && (
                                      <section.icon className="h-6 w-6 text-blue-600" />
                                    )}
                                    <h2 className="text-xl font-semibold text-gray-900">
                              {section.title}
                                    </h2>
                                  </div>
                                  
                                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {section.fields.map((field) => {
                                        const shouldShow = !field.showIf || field.showIf(formValues);
                                        if (!shouldShow) return null;

                                        return (
                                          <div key={field.name} className="space-y-2">
                                  <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                                    {field.label}
                                  </label>
                                            {field.note && (
                                              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg mb-2">
                                                <div className="text-xs text-blue-800 whitespace-pre-line leading-relaxed">
                                                  {typeof field.note === 'function' ? field.note(formValues) : field.note}
                                                </div>
                                              </div>
                                            )}
                                            {renderField(field)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          </div>

                        {/* Navigation */}
                        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                          <div className="flex items-center justify-between">
                            {isQuestionnaireMode ? (
                              <>
                                <button
                                  type="button"
                                  onClick={prevStep}
                                  disabled={currentStep === 0}
                                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                    currentStep === 0
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-4 focus:ring-gray-100'
                                  }`}
                                >
                                  Previous
                                </button>

                                {currentStep === questionnaireSections.length - 1 ? (
                                  <div className="flex space-x-3">
                                    {actionButtons.slice(0, 2).map(button => (
                                      <button
                                        key={button.id}
                                        type={button.id === 'save' ? 'submit' : 'button'}
                                        onClick={() => {
                                          if (button.onClick) {
                                            void button.onClick();
                                          } else if (button.id !== 'save') {
                                            handleActionClick(button.id);
                                          }
                                        }}
                                        disabled={!button.enabled}
                                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-4 ${button.color} ${button.textColor}
                                        ${!button.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                                          flex items-center space-x-2
                                      `}
                                      >
                                        {button.icon && <button.icon className="h-5 w-5" />}
                                        <span>{button.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={nextStep}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all duration-200 focus:outline-none"
                                  >
                                    Continue
                                  </button>
                                )}
                              </>
                            ) : (
                              // Lead Details View Actions
                              <div className="flex items-center justify-between w-full">
                                <div className="flex space-x-3">
                                  {actionButtons.slice(0, 2).map(button => (
                                    <button
                                      key={button.id}
                                      type={button.id === 'save' ? 'submit' : 'button'}
                                      onClick={() => {
                                        if (button.onClick) {
                                          void button.onClick();
                                        } else if (button.id !== 'save') {
                                          handleActionClick(button.id);
                                        }
                                      }}
                                      disabled={!button.enabled}
                                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-4 ${button.color} ${button.textColor}
                                      ${!button.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                                        flex items-center space-x-2
                                    `}
                                    >
                                      {button.icon && <button.icon className="h-5 w-5" />}
                                      <span>{button.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Additional Actions (only on last step for questionnaire or always for lead details) */}
                        {(!isQuestionnaireMode || currentStep === questionnaireSections.length - 1) && (
                          <div className="border-t border-gray-200 bg-white px-6 py-4">
                            <div className="text-sm text-gray-600 mb-3">Additional Actions:</div>
                            <div className="flex flex-wrap gap-2">
                              {actionButtons.slice(2).map(button => (
                                <button
                                  key={button.id}
                                  type="button"
                                  onClick={() => handleActionClick(button.id)}
                                  disabled={!button.enabled}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-4 ${button.color} ${button.textColor}
                                    ${!button.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                                  `}
                                >
                                  {button.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>

      {/* Confirmation Modal */}
      <Transition.Root show={showConfirmationModal} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={setShowConfirmationModal}>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-70 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-70 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-6 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Confirm Action
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          {getConfirmationMessage(selectedAction)}
                        </p>
                        {selectedAction === 'follow_up' && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label htmlFor="follow-up-date" className="block text-sm font-medium text-gray-700">
                                Select Date
                              </label>
                              <input
                                type="date"
                                id="follow-up-date"
                                name="follow-up-date"
                                value={followUpDate.split('T')[0]}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                max={getMaxFollowUpDate()}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="follow-up-time" className="block text-sm font-medium text-gray-700">
                                Select Time (Optional)
                              </label>
                              <input
                                type="time"
                                id="follow-up-time"
                                name="follow-up-time"
                                value={followUpTime}
                                onChange={(e) => setFollowUpTime(e.target.value)}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Leave empty to automatically set to 00:00
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedAction === 'blacklist' && (
                          <p className="mt-2 text-sm text-red-600">
                            ⚠️ Blacklisted leads will be permanently removed from active leads and cannot be contacted again.
                          </p>
                        )}
                        {selectedAction === 'no_answer' && (
                          <p className="mt-2 text-sm text-blue-600">
                            ℹ️ The lead will automatically return to active status after 14 days.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className={`inline-flex w-full justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-all duration-200 ${
                        selectedAction === 'blacklist' 
                          ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500'
                          : 'bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500'
                      } focus:ring-4 focus:ring-offset-2`}
                      onClick={handleConfirmedAction}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-all duration-200 focus:ring-4 focus:ring-gray-100"
                      onClick={() => setShowConfirmationModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Unsaved Changes Modal */}
      <Transition.Root show={showUnsavedChangesModal} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={setShowUnsavedChangesModal}>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-70 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-70 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-6 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Unsaved Changes
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto transition-all duration-200 focus:ring-4 focus:ring-red-100"
                      onClick={handleConfirmedClose}
                    >
                      Leave without saving
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-all duration-200 focus:ring-4 focus:ring-gray-100"
                      onClick={handleCancelClose}
                    >
                      Continue editing
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}

// Define questionnaire sections with proper typing
const createQuestionnaireSections = (isQuestionnaireMode: boolean): Section[] => [
  {
    title: isQuestionnaireMode ? "Let's start with some basic information" : "Personal Information",
    fields: [
      { name: "full_name", label: isQuestionnaireMode ? "What is your full name?" : "Full Name", type: "text" } as TextField,
      { name: "email", label: isQuestionnaireMode ? "What is your email address?" : "Email", type: "text" } as TextField,
      { name: "phone_number", label: isQuestionnaireMode ? "What is your primary contact number?" : "Primary Phone", type: "tel", disabled: true } as TextField,
      { name: "phone_number_2", label: isQuestionnaireMode ? "Do you have an alternative contact number?" : "Secondary Phone", type: "tel" } as TextField,
      { name: "phone_number_3", label: isQuestionnaireMode ? "Any other contact number we should know about?" : "Additional Phone", type: "tel" } as TextField,
    ]
  },
  {
    title: isQuestionnaireMode ? "Tell us about your residency status" : "Residential Status",
    fields: [
      { 
        name: "residential_status", 
        label: "Are you a local or foreigner?", 
        type: "radio",
        options: ["Local", "Foreigner"],
        note: "Please select your residency status"
      } as RadioField,
      { 
        name: "has_work_pass_expiry", 
        label: isQuestionnaireMode 
          ? "When does your work pass expire?" 
          : "When does your work pass expire?", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "⚠️ Must have at least 6 months validity from today (DD/MM/YYYY format)"
      } as TextField,
      { 
        name: "proof_of_residence_type", 
        label: isQuestionnaireMode 
          ? "What proof of residence documents can you provide?" 
          : "Proof of Residence Documents", 
        type: "checkbox-group",
        options: ["Bank Statement", "Utility Bill", "Handphone Bill"],
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "📄 Select all documents you can provide:\n\n⚠️ Important: From 6th of the Month onwards, must provide current month statement"
      } as CheckboxGroupField,
      { 
        name: "has_letter_of_consent", 
        label: isQuestionnaireMode 
          ? "Do you have a letter of consent from ICA?" 
          : "Has Letter of Consent", 
        type: "checkbox",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "📝 Required for LTVP and LTVP+ pass holders only"
      } as CheckboxField
    ]
  },
  {
    title: isQuestionnaireMode ? "Let's discuss your employment" : "Employment Details",
    fields: [
      { 
        name: "employment_status", 
        label: isQuestionnaireMode ? "What is your current employment situation?" : "Employment Status", 
        type: "select",
        options: ["Full-Time", "Part-Time", "Self-Employed", "Self-Employed (Platform Worker)", "Unemployed", "UNKNOWN"]
      },
      { 
        name: "employment_salary", 
        label: isQuestionnaireMode ? "What is your monthly income?" : "Monthly Income", 
        type: "text"
      },
      { 
        name: "employment_length", 
        label: isQuestionnaireMode ? "How long have you been employed?" : "Length of Employment", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.employment_status !== "Unemployed"
      },
      {
        name: "has_payslip_3months",
        label: isQuestionnaireMode 
          ? "Do you have the latest 3 months payslips from your employer?" 
          : "Has Latest 3 Months Payslips",
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
    ] as Field[]
  },
  {
    title: isQuestionnaireMode ? "Tell us about your loan requirements" : "Loan Information",
    fields: [
      { 
        name: "amount", 
        label: isQuestionnaireMode ? "How much would you like to borrow?" : "Requested Loan Amount", 
        type: "text" 
      },
      { 
        name: "loan_purpose", 
        label: isQuestionnaireMode ? "What do you need the loan for?" : "Purpose of Loan", 
        type: "text" 
      },
      { 
        name: "existing_loans", 
        label: isQuestionnaireMode ? "Do you have any existing loans?" : "Has Existing Loans", 
        type: "select", 
        options: ["Yes", "No", "UNKNOWN"] 
      },
      { 
        name: "outstanding_loan_amount", 
        label: isQuestionnaireMode ? "What is the total amount of your existing loans?" : "Outstanding Loan Amount", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.existing_loans === "Yes"
      }
    ] as Field[]
  },
  {
    title: isQuestionnaireMode ? "How would you like us to contact you?" : "Communication Preferences",
    fields: [
      { 
        name: "contact_preference", 
        label: isQuestionnaireMode ? "What's your preferred way of communication?" : "Preferred Contact Method", 
        type: "select",
        options: ["No Preferences", "WhatsApp", "Call", "SMS", "Email"]
      },
      { 
        name: "communication_language", 
        label: isQuestionnaireMode ? "Which language would you prefer?" : "Preferred Language", 
        type: "select",
        options: ["No Preferences", "English", "Mandarin", "Malay", "Tamil", "Others"]
      }
    ] as Field[]
  }
]; 