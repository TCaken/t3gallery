import { Fragment, useMemo, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, CalendarIcon } from '@heroicons/react/24/outline'
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

type Field = TextField | SelectField | CheckboxField;

interface Section {
  title: string;
  fields: Field[];
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
  [key: string]: string | boolean | Date | number | null | undefined;
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
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'book',
      label: 'Book Appointment',
      color: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-white',
      icon: CalendarIcon,
      enabled: true,
      onClick: handleBooking
    },
    {
      id: 'follow_up',
      label: 'Schedule Follow-up',
      color: 'bg-purple-600 hover:bg-purple-700',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'no_answer',
      label: 'No Answer',
      color: 'bg-gray-600 hover:bg-gray-700',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'give_up',
      label: 'Give Up',
      color: 'bg-red-600 hover:bg-red-700',
      textColor: 'text-white',
      enabled: true
    },
    {
      id: 'blacklist',
      label: 'Blacklist',
      color: 'bg-black hover:bg-gray-900',
      textColor: 'text-white',
      enabled: true
    }
  ];

  const renderField = (field: Field) => {
    if (isSelectField(field)) {
      return (
        <select
          id={field.name.toString()}
          name={field.name.toString()}
          value={formValues[field.name]?.toString() ?? ''}
          onChange={handleFieldChange}
          className="mt-1 block w-full rounded-lg border-2 border-gray-300 py-2.5 px-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-base"
        >
          <option value="">Select...</option>
          {field.options.map((option: string) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (isCheckboxField(field)) {
      return (
        <div className="mt-2 flex items-center">
          <input
            type="checkbox"
            id={field.name.toString()}
            name={field.name.toString()}
            checked={!!formValues[field.name]}
            onChange={handleFieldChange}
            className="h-5 w-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor={field.name.toString()} className="ml-3 text-base text-gray-700">
            Yes
          </label>
        </div>
      );
    }

    if (isTextField(field)) {
      return (
        <input
          type={field.type}
          id={field.name.toString()}
          name={field.name.toString()}
          value={formValues[field.name]?.toString() ?? ''}
          onChange={handleFieldChange}
          disabled={field.disabled}
          className={`mt-1 block w-full rounded-lg border-2 py-2.5 px-3 shadow-sm text-base ${
            field.disabled 
              ? 'bg-gray-50 border-gray-200 text-gray-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
          }`}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseAttempt}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-out duration-400"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in duration-400"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto relative w-screen max-w-3xl">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white pt-6 shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <Dialog.Title className="text-xl font-semibold leading-6 text-gray-900">
                              {isQuestionnaireMode ? "Lead Questionnaire" : "Edit Lead"}
                            </Dialog.Title>
                            <p className="mt-2 text-base text-gray-600">
                              {isQuestionnaireMode 
                                ? "Please help us understand your requirements better" 
                                : "Update lead information"}
                            </p>
                          </div>
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                              onClick={handleCloseAttempt}
                            >
                              <span className="sr-only">Close panel</span>
                              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="relative mt-6 flex-1 px-4 sm:px-6">
                        <form onSubmit={handleSubmit} className="space-y-8 pb-32">
                          {questionnaireSections.map((section, sectionIndex) => (
                            <div key={section.title} className="border-b border-gray-200 pb-8">
                              <h3 className="text-lg font-medium text-gray-900 mb-6">
                                {section.title}
                              </h3>
                              <div className="grid grid-cols-1 gap-y-8 gap-x-4 sm:grid-cols-2">
                                {section.fields.map((field, fieldIndex) => {
                                  const shouldShow = !field.showIf || field.showIf(formValues);
                                  if (!shouldShow) return null;

                                  return (
                                    <div key={field.name} className={field.type === 'checkbox' ? 'col-span-2' : undefined}>
                                      <label htmlFor={field.name} className="block text-base font-medium text-gray-700 mb-2">
                                        {field.label}
                                      </label>
                                      {renderField(field)}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {/* Action Buttons */}
                          <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t-2 border-gray-200 px-4 py-4 shadow-lg">
                            <div className="flex flex-col space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {actionButtons.map(button => (
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
                                    className={`px-6 py-2.5 rounded-lg text-base font-medium ${button.color} ${button.textColor}
                                      ${!button.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                                      ${selectedAction === button.id ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                                      flex items-center gap-2
                                    `}
                                  >
                                    {button.icon && <button.icon className="h-5 w-5" />}
                                    {button.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 border-2 border-gray-200">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Confirm Action
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                      className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto ${
                        selectedAction === 'blacklist' 
                          ? 'bg-red-600 hover:bg-red-500'
                          : 'bg-yellow-600 hover:bg-yellow-500'
                      }`}
                      onClick={handleConfirmedAction}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 border-2 border-gray-200">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Unsaved Changes
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                      onClick={handleConfirmedClose}
                    >
                      Leave without saving
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
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
        label: isQuestionnaireMode ? "Are you a local resident or foreigner?" : "Residential Status", 
        type: "select",
        options: ["Local", "Foreigner", "UNKNOWN"]
      } as SelectField,
      { 
        name: "has_proof_of_residence", 
        label: isQuestionnaireMode ? "Can you provide proof of residence?" : "Has Proof of Residence", 
        type: "checkbox",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner"
      } as CheckboxField,
      { 
        name: "has_letter_of_consent", 
        label: isQuestionnaireMode ? "Do you have a letter of consent?" : "Has Letter of Consent", 
        type: "checkbox",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner"
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
        options: ["Full-Time", "Part-Time", "Self-Employed", "Unemployed", "UNKNOWN"]
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
      }
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
        options: ["No Preference", "WhatsApp", "Call", "SMS", "Email", "UNKNOWN"]
      },
      { 
        name: "communication_language", 
        label: isQuestionnaireMode ? "Which language would you prefer?" : "Preferred Language", 
        type: "select",
        options: ["No Preference", "English", "Mandarin", "Malay", "Tamil", "Others", "UNKNOWN"]
      }
    ] as Field[]
  }
]; 