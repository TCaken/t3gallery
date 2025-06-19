import { Fragment, useMemo, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from "~/server/db/schema";
import { useRouter } from 'next/navigation';
import { createQuestionnaireSections } from '~/app/_lib/questionnaire';
import { type Field, type Section } from '~/app/_lib/questionnaire';
import { addLeadNote } from '~/app/_actions/leadActions';

type Lead = InferSelectModel<typeof leads>;

// Type guard functions using more flexible approach
const isSelectField = (field: Field): field is Field & { type: 'select'; options: string[] } => {
  return field.type === 'select';
};

const isCheckboxField = (field: Field): field is Field & { type: 'checkbox' } => {
  return field.type === 'checkbox';
};

const isTextField = (field: Field): field is Field & { type: 'text' | 'tel' | 'textarea' } => {
  return field.type === 'text' || field.type === 'tel' || field.type === 'textarea';
};

const isRadioField = (field: Field): field is Field & { type: 'radio'; options: string[] } => {
  return field.type === 'radio';
};

const isCheckboxGroupField = (field: Field): field is Field & { type: 'checkbox-group'; options: string[] } => {
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
  lead_notes?: string;
  [key: string]: string | boolean | Date | number | null | undefined | string[];
}

interface LeadEditSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSave: (updatedLead: Partial<Lead>) => Promise<void>;
  onAction?: (action: string, leadId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function LeadEditSlideOver({ isOpen, onClose, lead, onSave, onAction, showNotification = (message: string) => console.log(message) }: LeadEditSlideOverProps) {
  const [selectedAction, setSelectedAction] = useState<string>('save');
  const router = useRouter();
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpTime, setFollowUpTime] = useState<string>('');
  const [formValues, setFormValues] = useState<FormValues>({
    ...lead,
    follow_up_time: ''
  });
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues>(lead);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReasonText, setCustomReasonText] = useState('');

  // console.log("LeadEditSlideOver", lead);
  
  // Reset form and initial values when lead changes
  useEffect(() => {
    const newValues: FormValues = {
      ...lead,
      follow_up_time: '',
      created_at: lead.created_at ? new Date(lead.created_at) : undefined
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
      case 'status_reason_modal':
        return 'Please select a reason for changing the status:';
      default:
        return '';
    }
  };

  // Get default follow-up date (today at 00:00 Singapore time)
  const getDefaultFollowUpDate = () => {
    // Get current date in Singapore timezone
    const now = new Date();
    const sgTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
    sgTime.setHours(0, 0, 0, 0);
    
    // Format for date input (YYYY-MM-DD)
    const year = sgTime.getFullYear();
    const month = String(sgTime.getMonth() + 1).padStart(2, '0');
    const day = String(sgTime.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Get max follow-up date (30 days from now in Singapore time)
  const getMaxFollowUpDate = () => {
    const now = new Date();
    const sgTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
    const maxDate = new Date(sgTime);
    maxDate.setDate(maxDate.getDate() + 30);
    
    const year = maxDate.getFullYear();
    const month = String(maxDate.getMonth() + 1).padStart(2, '0');
    const day = String(maxDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Format date for display (Singapore timezone)
  const formatDateForDisplay = (date: string) => {
    // Parse the date and format it in Singapore time
    const dateObj = new Date(date);
    return dateObj.toLocaleString('en-SG', { 
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

  const REASON_OPTIONS = [
    { value: 'blacklisted_do_not_call', label: 'Blacklisted - Do Not Call', finalStatus: 'blacklisted' },
    { value: 'blacklisted_drs_bankrupt', label: 'Blacklist - DRS / Bankrupt', finalStatus: 'blacklisted' },
    { value: 'blacklisted_others', label: 'Blacklisted - Others', finalStatus: 'blacklisted', customReason: true },
    { value: 'give_up_trouble_maker', label: 'Give Up - Trouble Maker', finalStatus: 'give_up' },
    { value: 'give_up_already_got_loan', label: 'Give Up - Already Got Loan', finalStatus: 'give_up' },
    { value: 'give_up_income_too_low', label: 'Give Up - Income Too Low', finalStatus: 'give_up' },
    { value: 'give_up_underage', label: 'Give Up - Underage', finalStatus: 'give_up' },
    { value: 'give_up_not_interested', label: 'Give Up - Not Interested', finalStatus: 'give_up' },
    { value: 'give_up_no_income_proof', label: 'Give Up - No Income Proof', finalStatus: 'give_up' },
    { value: 'give_up_unemployed', label: 'Give Up - Unemployed', finalStatus: 'give_up' },
    { value: 'give_up_others', label: 'Give Up - Others', finalStatus: 'give_up', customReason: true },
  ];

  // Handle confirmed action
  const handleConfirmedAction = async () => {
    setShowConfirmationModal(false);
    
    if (selectedAction === 'follow_up' && followUpDate) {
      // Create date in Singapore timezone
      const timeStr = followUpTime || '00:00'; // Use 00:00 if no time selected
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0] ?? '0', 10);
      const minutes = parseInt(timeParts[1] ?? '0', 10);
      
      // Create date object in Singapore timezone
      const sgDate = new Date(followUpDate);
      sgDate.setHours(hours, minutes, 0, 0);
      
      // Convert to UTC for database storage
      // Note: The date input already gives us the correct date, we just need to adjust for timezone
      const sgTimeZoneOffset = 8 * 60; // GMT+8 in minutes
      const localTimeZoneOffset = sgDate.getTimezoneOffset(); // Local timezone offset in minutes
      const utcDate = new Date(sgDate.getTime() - (sgTimeZoneOffset + localTimeZoneOffset) * 60 * 1000);
      
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
    
    if (selectedAction === 'status_reason_modal') {
      if (!selectedReason) {
        showNotification('Please select a reason', 'error');
        return;
      }

      const reasonOption = REASON_OPTIONS.find(option => option.value === selectedReason);
      if (!reasonOption) {
        showNotification('Invalid reason selected', 'error');
        return;
      }

      // If custom reason is required, ensure it is filled
      if (reasonOption.customReason && !customReasonText.trim()) {
        showNotification('Please provide a reason for this status', 'error');
        return;
      }

      // Save any pending changes first
      const updatedValues = {
        ...formValues,
        status: reasonOption.finalStatus,
        eligibility_notes: reasonOption.customReason
          ? `${reasonOption.label.toUpperCase()} (${customReasonText.trim()})`
          : `${reasonOption.label.toUpperCase()}`,
        follow_up_date: null // Clear follow-up date when changing to final status
      };

      // console.log("updatedValues", updatedValues);
      setFormValues(updatedValues);
      
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
    let leadNotesContent = '';

    // Add all form fields to updatedLead
    const sections = Array.isArray(questionnaireSections) ? questionnaireSections : [];
    sections.forEach((section) => {
      if (section?.fields && Array.isArray(section.fields)) {
        section.fields.forEach((field) => {
          if (!field?.name) return;
          
          const value = formData.get(field.name.toString());
          
          // Skip if value is null or empty string for optional fields
          if (value === null || value === '') return;

          const fieldName = field.name.toString();
          
          // Special handling for lead_notes - extract for lead notes
          if (fieldName === 'lead_notes') {
            leadNotesContent = value.toString();
            return; // Don't add to updatedLead
          }
          
          if (isCheckboxField(field)) {
            updatedLead[fieldName] = value === 'on';
          } else if (typeof value === 'string') {
            updatedLead[fieldName] = value;
          }
        });
      }
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
      case 'status_reason_modal':
        // This action will trigger the parent's modal, no status change here
        break;
    }

    console.log("finalValues", finalValues);
    console.log("selectedAction", selectedAction);

    if (leadNotesContent.trim() && lead.id) {
      try {
        await addLeadNote(lead.id, leadNotesContent.trim());
        showNotification?.('Lead notes saved successfully', 'success');
      } catch (error) {
        console.error('Error saving lead notes:', error);
        showNotification?.('Failed to save lead notes', 'error');
      }
    }



    // Save the lead first
    await onSave(finalValues);
    
    // If there are lead notes, create them separately
    
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

  // Handle form field changes for both input and textarea
  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' && 'checked' in e.target ? e.target.checked : value;
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
  // console.log("isQuestionnaireMode", isQuestionnaireMode, createdDate, updatedDate);
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
        router.push(`/dashboard/leads/${lead.id}/appointment`);
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
      label: 'Return Call',
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
      id: 'status_reason_modal',
      label: 'Give Up / Blacklist',
      color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
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
            {'options' in field && field.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    if (isRadioField(field)) {
      return (
        <div className="space-y-3">
          {'options' in field && field.options.map((option: string) => (
            <label key={option} className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
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
          {'options' in field && field.options.map((option: string) => (
            <label key={option} className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
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
          <label className="flex items-center space-x-3 cursor-pointer group">
            <div className="relative flex items-center justify-center">
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
      // Handle textarea type
      if (field.name === 'lead_notes') {
        return (
          <div className="space-y-2">
            <textarea
              id={field.name.toString()}
              name={field.name.toString()}
              value={formValues[field.name]?.toString() ?? ''}
              onChange={handleFieldChange}
              disabled={field.disabled}
              rows={4}
              className={`w-full rounded-xl border-2 px-4 py-3 text-base shadow-sm transition-all duration-200 focus:outline-none resize-vertical ${
                field.disabled 
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'
              }`}
              placeholder="Enter your notes here..."
            />
          </div>
        );
      }
      
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
                      
                      {/* Progress Bar - only show in questionnaire mode */}
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
                            /* Questionnaire mode: Multi-step view */
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
                            /* Edit mode: Single-page view with all sections */
                            <div className="space-y-12">
                              {questionnaireSections.map((section, sectionIndex) => (
                                <div key={sectionIndex} className="space-y-6">
                                  <div className="border-b border-gray-200 pb-3">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      {section.title}
                                    </h3>
                                  </div>
                                  
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
                                            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                                              <div className="text-xs text-gray-600 whitespace-pre-line">
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
                              ))}
                            </div>
                          )}
                          </div>

                        {/* Navigation */}
                        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                          {isQuestionnaireMode ? (
                            /* Questionnaire mode: Step navigation */
                            <div className="flex items-center justify-between">
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
                            </div>
                          ) : (
                            /* Edit mode: Match the exact layout of questionnaire mode last page */
                            <div className="flex items-center justify-between">
                              <div></div> {/* Empty div to match the space where "Previous" button would be */}
                              
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

                        {/* Additional Actions */}
                        {((isQuestionnaireMode && currentStep === questionnaireSections.length - 1) || !isQuestionnaireMode) && (
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
        <Dialog as="div" className="relative z-[60]" onClose={() => setShowConfirmationModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-6 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                      Confirm Action
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        {getConfirmationMessage(selectedAction)}
                      </p>
                      {selectedAction === 'follow_up' && (
                        <div className="mt-4 space-y-3">
                          {/* Date and Time in a better layout */}
                          <div className="space-y-4">
                            {/* Date Selection */}
                            <div>
                              <label htmlFor="follow-up-date" className="justify-between items-center block text-sm font-medium text-gray-700 mb-2">
                                Select Date
                              </label>
                              <input
                                type="date"
                                id="follow-up-date"
                                name="follow-up-date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                min={getDefaultFollowUpDate()}
                                max={getMaxFollowUpDate()}
                                onClick={(e) => {
                                  // Auto-open calendar when clicking
                                  if (e.currentTarget.showPicker) {
                                    e.currentTarget.showPicker();
                                  }
                                }}
                                className="w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base px-4 py-3 cursor-pointer font-medium"
                                required
                              />
                            </div>

                            {/* Time Selection */}
                            <div>
                              {!showTimeInput ? (
                                <button
                                  type="button"
                                  onClick={() => setShowTimeInput(true)}
                                  className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400 px-4 py-3 text-sm text-gray-600 hover:text-blue-600 transition-all duration-200"
                                >
                                Add specific time (optional)
                                </button>
                              ) : (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="follow-up-time" className="text-sm font-medium text-gray-700">
                                      Specific Time
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFollowUpTime('');
                                        setShowTimeInput(false);
                                      }}
                                      className="text-xs text-gray-500 hover:text-red-600 font-medium px-2 py-1 rounded"
                                    >
                                      Remove time
                                    </button>
                                  </div>
                                  <input
                                    type="time"
                                    id="follow-up-time"
                                    name="follow-up-time"
                                    value={followUpTime}
                                    onChange={(e) => setFollowUpTime(e.target.value)}
                                    className="w-full rounded-lg border-2 border-blue-300 bg-blue-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base px-4 py-3 font-medium"
                                    placeholder="Select time..."
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Preview and helpful info */}
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <div className="text-sm">
                                <p className="text-blue-700 font-medium">
                                  {followUpDate ? (
                                    <>
                                      {new Date(followUpDate).toLocaleDateString('en-SG', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        timeZone: 'Asia/Singapore'
                                      })}
                                      {followUpTime && followUpTime !== '' ? (
                                        <span className="block text-blue-700 mt-1">
                                          at {followUpTime} (Singapore time)
                                        </span>
                                      ) : (
                                        <span className="block text-blue-700 text-sm mt-1">
                                          No specific time set
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    'Please select a date above'
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Helper text */}
                          <div className="text-center">
                            <p className="text-xs text-gray-500">
                              Click the date field to open calendar. All times in Singapore timezone (GMT+8)
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedAction === 'status_reason_modal' && (
                        <div className="mt-4 space-y-3">
                          <label htmlFor="reason-select" className="block text-sm font-medium text-gray-700 mb-2">
                            Select Reason
                          </label>
                          <select
                            id="reason-select"
                            value={selectedReason}
                            onChange={(e) => { setSelectedReason(e.target.value); setCustomReasonText(''); }}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Select a reason...</option>
                            {REASON_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {/* Show custom reason input if needed */}
                          {REASON_OPTIONS.find(opt => opt.value === selectedReason)?.customReason && (
                            <div className="mt-3">
                              <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
                                Please specify the reason
                              </label>
                              <input
                                id="custom-reason"
                                type="text"
                                value={customReasonText}
                                onChange={e => setCustomReasonText(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="Enter the reason here..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className={`inline-flex w-full justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-all duration-200 ${
                        selectedAction === 'status_reason_modal' 
                          ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500'
                          : 'bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500'
                      } focus:ring-4 focus:ring-offset-2 ${
                        selectedAction === 'status_reason_modal' && !selectedReason ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={handleConfirmedAction}
                      disabled={selectedAction === 'status_reason_modal' && !selectedReason}
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

 