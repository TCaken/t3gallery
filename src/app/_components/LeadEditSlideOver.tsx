import { Fragment, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from "~/server/db/schema";

type Lead = InferSelectModel<typeof leads>;

interface EditableFields {
  full_name: boolean;
  phone_number: boolean;
  phone_number_2: boolean;
  phone_number_3: boolean;
  email: boolean;
  residential_status?: boolean;
  employment_status?: boolean;
  loan_purpose?: boolean;
  existing_loans?: boolean;
  amount?: boolean;
  status?: boolean;
  lead_type?: boolean;
}

interface LeadEditSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSave: (updatedLead: Partial<Lead>) => Promise<void>;
}

export default function LeadEditSlideOver({ isOpen, onClose, lead, onSave }: LeadEditSlideOverProps) {
  // Determine which fields can be edited based on lead status
  const editableFields = useMemo<EditableFields>(() => {
    const baseFields = {
      full_name: true,
      phone_number: true,
      phone_number_2: true,
      phone_number_3: true,
      email: true,
    };

    // If lead is completed/done, only allow certain fields
    if (lead.status === 'done' || lead.status === 'blacklisted') {
      return {
        ...baseFields,
        phone_number: false,
        status: false,
        lead_type: false,
      };
    }

    // If lead is in progress (follow_up, booked, etc.)
    if (['follow_up', 'booked', 'assigned'].includes(lead.status ?? '')) {
      return {
        ...baseFields,
        residential_status: true,
        employment_status: true,
        loan_purpose: true,
        existing_loans: true,
        amount: true,
        status: true,
      };
    }

    // For new or initial states, allow all fields
    return {
      ...baseFields,
      residential_status: true,
      employment_status: true,
      loan_purpose: true,
      existing_loans: true,
      amount: true,
      status: true,
      lead_type: true,
    };
  }, [lead.status]);

  const statusOptions = useMemo(() => {
    const allStatuses = [
      'new',
      'assigned',
      'no_answer',
      'follow_up',
      'booked',
      'done',
      'missed/RS',
      'unqualified',
      'give_up',
      'blacklisted'
    ];

    // Filter available status transitions based on current status
    switch (lead.status) {
      case 'new':
        return ['new', 'assigned', 'unqualified', 'blacklisted'];
      case 'assigned':
        return ['assigned', 'no_answer', 'follow_up', 'booked', 'unqualified'];
      case 'no_answer':
        return ['no_answer', 'follow_up', 'unqualified', 'give_up'];
      case 'follow_up':
        return ['follow_up', 'booked', 'no_answer', 'unqualified', 'give_up'];
      case 'booked':
        return ['booked', 'done', 'missed/RS'];
      case 'done':
        return ['done']; // Can't change from done
      case 'missed/RS':
        return ['missed/RS', 'follow_up', 'unqualified', 'give_up'];
      case 'unqualified':
        return ['unqualified']; // Can't change from unqualified
      case 'give_up':
        return ['give_up']; // Can't change from give up
      case 'blacklisted':
        return ['blacklisted']; // Can't change from blacklisted
      default:
        return allStatuses;
    }
  }, [lead.status]);

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                <Dialog.Panel className="pointer-events-auto relative w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl">
                    <div className="px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-gray-900">
                          Questionnaire for {lead.full_name}
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                            onClick={onClose}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      {/* <div className="mt-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          lead.status === 'done' ? 'bg-green-50 text-green-700' :
                          lead.status === 'blacklisted' ? 'bg-red-50 text-red-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {lead.status}
                        </span>
                      </div> */}
                    </div>

                    <div className="relative mt-6 flex-1 px-4 sm:px-6">
                      <form className="space-y-4" onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const updatedLead: Partial<Lead> = {};

                        // Only include fields that are editable and have changed
                        if (editableFields.full_name) {
                          updatedLead.full_name = formData.get('full_name') as string;
                        }
                        if (editableFields.phone_number) {
                          updatedLead.phone_number = formData.get('phone_number') as string;
                        }
                        if (editableFields.phone_number_2) {
                          updatedLead.phone_number_2 = formData.get('phone_number_2') as string;
                        }
                        if (editableFields.phone_number_3) {
                          updatedLead.phone_number_3 = formData.get('phone_number_3') as string;
                        }
                        if (editableFields.email) {
                          updatedLead.email = formData.get('email') as string;
                        }
                        if (editableFields.residential_status) {
                          updatedLead.residential_status = formData.get('residential_status') as string;
                        }
                        if (editableFields.employment_status) {
                          updatedLead.employment_status = formData.get('employment_status') as string;
                        }
                        if (editableFields.loan_purpose) {
                          updatedLead.loan_purpose = formData.get('loan_purpose') as string;
                        }
                        if (editableFields.existing_loans) {
                          updatedLead.existing_loans = formData.get('existing_loans') as string;
                        }
                        if (editableFields.amount) {
                          updatedLead.amount = formData.get('amount') as string;
                        }
                        if (editableFields.status) {
                          updatedLead.status = formData.get('status') as string;
                        }
                        if (editableFields.lead_type) {
                          updatedLead.lead_type = formData.get('lead_type') as string;
                        }

                        void onSave(updatedLead);
                      }}>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                              Full Name
                            </label>
                            <input
                              type="text"
                              name="full_name"
                              id="full_name"
                              defaultValue={lead.full_name ?? ''}
                              disabled={!editableFields.full_name}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                !editableFields.full_name ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div>
                            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              name="phone_number"
                              id="phone_number"
                              defaultValue={lead.phone_number}
                              disabled={!editableFields.phone_number}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                !editableFields.phone_number ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div>
                            <label htmlFor="phone_number_2" className="block text-sm font-medium text-gray-700">
                              Phone Number 2
                            </label>
                            <input
                              type="tel"
                              name="phone_number_2"
                              id="phone_number_2"
                              defaultValue={lead.phone_number_2 ?? ''}
                              disabled={!editableFields.phone_number_2}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                !editableFields.phone_number_2 ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div>
                            <label htmlFor="phone_number_3" className="block text-sm font-medium text-gray-700">
                              Phone Number 3
                            </label>
                            <input
                              type="tel"
                              name="phone_number_3"
                              id="phone_number_3"
                              defaultValue={lead.phone_number_3 ?? ''}
                              disabled={!editableFields.phone_number_3}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                !editableFields.phone_number_3 ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Email
                            </label>
                            <input
                              type="text"
                              name="email"
                              id="email"
                              defaultValue={lead.email ?? ''}
                              disabled={!editableFields.email}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                !editableFields.email ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          {editableFields.residential_status && (
                            <div>
                              <label htmlFor="residential_status" className="block text-sm font-medium text-gray-700">
                                Residential Status
                              </label>
                              <input
                                type="text"
                                name="residential_status"
                                id="residential_status"
                                defaultValue={lead.residential_status ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          {editableFields.employment_status && (
                            <div>
                              <label htmlFor="employment_status" className="block text-sm font-medium text-gray-700">
                                Employment Status
                              </label>
                              <input
                                type="text"
                                name="employment_status"
                                id="employment_status"
                                defaultValue={lead.employment_status ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          {editableFields.loan_purpose && (
                            <div>
                              <label htmlFor="loan_purpose" className="block text-sm font-medium text-gray-700">
                                Loan Purpose
                              </label>
                              <input
                                type="text"
                                name="loan_purpose"
                                id="loan_purpose"
                                defaultValue={lead.loan_purpose ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          {editableFields.existing_loans && (
                            <div>
                              <label htmlFor="existing_loans" className="block text-sm font-medium text-gray-700">
                                Existing Loans
                              </label>
                              <input
                                type="text"
                                name="existing_loans"
                                id="existing_loans"
                                defaultValue={lead.existing_loans ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          {editableFields.amount && (
                            <div>
                              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                                Amount
                              </label>
                              <input
                                type="text"
                                name="amount"
                                id="amount"
                                defaultValue={lead.amount ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          {editableFields.status && (
                            <div>
                              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                                Status
                              </label>
                              <select
                                name="status"
                                id="status"
                                defaultValue={lead.status ?? ''}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              >
                                {statusOptions.map(status => (
                                  <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            Save
                          </button>
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
  );
} 