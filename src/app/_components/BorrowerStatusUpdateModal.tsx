'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { updateBorrower } from '~/app/_actions/borrowers';
import { createBorrowerNote } from '~/app/_actions/borrowerNotes';

interface BorrowerStatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrower: {
    id: number;
    full_name: string;
    phone_number: string;
    status: string;
  } | null;
  preSelectedStatus?: 'follow_up' | 'no_answer' | 'give_up' | 'blacklisted';
  onUpdate?: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function BorrowerStatusUpdateModal({
  isOpen,
  onClose,
  borrower,
  preSelectedStatus,
  onUpdate,
  showNotification = (message: string) => console.log(message)
}: BorrowerStatusUpdateModalProps) {
  const [selectedAction, setSelectedAction] = useState<string>(preSelectedStatus || '');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpTime, setFollowUpTime] = useState<string>('');
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReasonText, setCustomReasonText] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedAction(preSelectedStatus || '');
      setFollowUpDate(getDefaultFollowUpDate());
      setFollowUpTime('');
      setShowTimeInput(false);
      setSelectedReason('');
      setCustomReasonText('');
      setAdditionalNotes('');
    }
  }, [isOpen, preSelectedStatus]);

  const REASON_OPTIONS = [
    { value: 'blacklisted_do_not_call', label: 'Blacklisted - Do Not Call', finalStatus: 'blacklisted' },
    { value: 'blacklisted_drs_bankrupt', label: 'Blacklist - DRS / Bankrupt', finalStatus: 'blacklisted' },
    { value: 'blacklisted_others', label: 'Blacklisted - Others', finalStatus: 'blacklisted', customReason: true },
    { value: 'give_up_trouble_maker', label: 'Give Up - Trouble Maker', finalStatus: 'give_up' },
    { value: 'give_up_already_got_loan', label: 'Give Up - Already Got Loan', finalStatus: 'give_up' },
    { value: 'give_up_cash_flow_ok', label: 'Give Up - Cash Flow Ok', finalStatus: 'give_up' },
    { value: 'give_up_loan_plan_dispute_on_charges', label: 'Give Up - Loan Plan & Dispute on Charges', finalStatus: 'give_up' },
    { value: 'give_up_feedback_retail_payment_refund_policy', label: 'Give Up - Feedback (Retail, Payment, Refund Policy)', finalStatus: 'give_up' },
    { value: 'give_up_unsatisfied_service_location_waiting_time_income_etc', label: 'Give Up - Unsatisfied Service (Location, Waiting Time, Income etc)', finalStatus: 'give_up' },
    { value: 'give_up_prs_r', label: 'Give Up - PRS/R', finalStatus: 'give_up' },
    { value: 'give_up_not_interested', label: 'Give Up - Not Interested', finalStatus: 'give_up' },
    { value: 'give_up_no_income_proof', label: 'Give Up - No Income Proof', finalStatus: 'give_up' },
    { value: 'give_up_unemployed', label: 'Give Up - Unemployed', finalStatus: 'give_up' },
    { value: 'give_up_others', label: 'Give Up - Others', finalStatus: 'give_up', customReason: true },
  ];

  // Get default follow-up date (today at 00:00 Singapore time)
  const getDefaultFollowUpDate = () => {
    const now = new Date();
    const sgTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
    sgTime.setHours(0, 0, 0, 0);
    
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

  // Get confirmation message based on action
  const getConfirmationMessage = (action: string) => {
    switch (action) {
      case 'follow_up':
        return 'The borrower will be scheduled for follow-up on the selected date.';
      case 'no_answer':
        return 'The borrower will be marked as "No Answer" and will stay in this state for 14 days before requiring action.';
      case 'give_up':
        return 'Are you sure you want to give up on this borrower? This action can be reversed later if needed.';
      case 'blacklisted':
        return 'Warning: Blacklisting this borrower will permanently remove them from active borrowers. This action cannot be undone.';
      case 'status_reason_modal':
        return 'Please select a reason for changing the status:';
      default:
        return '';
    }
  };

  const handleConfirm = async () => {
    if (!borrower) return;

    try {
      setSaving(true);
      
      // Handle follow-up with date/time
      if (selectedAction === 'follow_up') {
        if (!followUpDate) {
          showNotification('Please select a follow-up date', 'error');
          return;
        }

        // Create date in Singapore timezone
        const timeStr = followUpTime || '00:00';
        const timeParts = timeStr.split(':');
        const hours = parseInt(timeParts[0] ?? '0', 10);
        const minutes = parseInt(timeParts[1] ?? '0', 10);
        
        const sgDate = new Date(followUpDate);
        sgDate.setHours(hours, minutes, 0, 0);
        
        // Convert to UTC for database storage
        const sgTimeZoneOffset = 8 * 60;
        const localTimeZoneOffset = sgDate.getTimezoneOffset();
        const utcDate = new Date(sgDate.getTime() - (sgTimeZoneOffset + localTimeZoneOffset) * 60 * 1000);
        
        // Update borrower
        await updateBorrower({
          id: borrower.id,
          status: 'follow_up',
          follow_up_date: utcDate
        });

        // Add note
        const noteContent = `STATUS UPDATE: Set to Follow-up for ${followUpDate}${followUpTime ? ` at ${followUpTime}` : ''}`;
        await createBorrowerNote({
          borrower_id: borrower.id,
          content: noteContent,
          note_type: 'note'
        });

        showNotification('Borrower scheduled for follow-up successfully', 'success');
      }
      
      // Handle no answer
      else if (selectedAction === 'no_answer') {
        await updateBorrower({
          id: borrower.id,
          status: 'no_answer',
          follow_up_date: undefined
        });

        await createBorrowerNote({
          borrower_id: borrower.id,
          content: 'STATUS UPDATE: Marked as No Answer',
          note_type: 'note'
        });

        showNotification('Borrower marked as No Answer', 'success');
      }
      
      // Handle give up/blacklist with reason
      else if (selectedAction === 'status_reason_modal') {
        if (!selectedReason) {
          showNotification('Please select a reason', 'error');
          return;
        }

        const reasonOption = REASON_OPTIONS.find(option => option.value === selectedReason);
        if (!reasonOption) {
          showNotification('Invalid reason selected', 'error');
          return;
        }

        // Check if custom reason is required
        if (reasonOption.customReason && !customReasonText.trim()) {
          showNotification('Please provide a reason for this status', 'error');
          return;
        }

        // Update borrower status
        await updateBorrower({
          id: borrower.id,
          status: reasonOption.finalStatus,
          follow_up_date: undefined
        });

        // Create status note
        const statusNote = reasonOption.customReason
          ? `STATUS UPDATE: ${reasonOption.label.toUpperCase()} (${customReasonText.trim()})`
          : `STATUS UPDATE: ${reasonOption.label.toUpperCase()}`;

        await createBorrowerNote({
          borrower_id: borrower.id,
          content: statusNote,
          note_type: 'note'
        });

        // Add additional notes if provided
        if (additionalNotes.trim()) {
          await createBorrowerNote({
            borrower_id: borrower.id,
            content: additionalNotes.trim(),
            note_type: 'note'
          });
        }

        showNotification(`Borrower status updated to ${reasonOption.finalStatus}`, 'success');
      }

      if (onUpdate) {
        onUpdate();
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating borrower status:', error);
      showNotification('Failed to update borrower status. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !borrower) return null;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    Update Borrower Status
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Borrower Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{borrower.full_name}</span> • {borrower.phone_number}
                  </p>
                  <p className="text-xs text-gray-500">Current status: {borrower.status}</p>
                </div>

                {/* Status Selection */}
                {!selectedAction && (
                  <div className="space-y-3 mb-6">
                    <p className="text-sm text-gray-600 mb-4">Select the new status:</p>
                    
                    <button
                      onClick={() => setSelectedAction('follow_up')}
                      className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      <div className="font-medium text-purple-600">Return Call / Follow-up</div>
                      <div className="text-sm text-gray-600">Schedule for follow-up with date/time</div>
                    </button>

                    <button
                      onClick={() => setSelectedAction('no_answer')}
                      className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-600">No Answer</div>
                      <div className="text-sm text-gray-600">Mark as no answer (14-day follow-up)</div>
                    </button>

                    <button
                      onClick={() => setSelectedAction('status_reason_modal')}
                      className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors"
                    >
                      <div className="font-medium text-red-600">Give Up / Blacklist</div>
                      <div className="text-sm text-gray-600">Final status with reason selection</div>
                    </button>
                  </div>
                )}

                {/* Follow-up Details */}
                {selectedAction === 'follow_up' && (
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-gray-600">{getConfirmationMessage(selectedAction)}</p>
                    
                    {/* Date Selection */}
                    <div>
                      <label htmlFor="follow-up-date" className="block text-sm font-medium text-gray-700 mb-2">
                        Select Date *
                      </label>
                      <input
                        type="date"
                        id="follow-up-date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        min={getDefaultFollowUpDate()}
                        max={getMaxFollowUpDate()}
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
                            value={followUpTime}
                            onChange={(e) => setFollowUpTime(e.target.value)}
                            className="w-full rounded-lg border-2 border-blue-300 bg-blue-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base px-4 py-3 font-medium"
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-sm text-blue-700 font-medium">
                        {followUpDate ? (
                          <>
                            {new Date(followUpDate).toLocaleDateString('en-SG', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              timeZone: 'Asia/Singapore'
                            })}
                            {followUpTime && (
                              <span className="block mt-1">at {followUpTime} (Singapore time)</span>
                            )}
                          </>
                        ) : (
                          'Please select a date above'
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* No Answer Details */}
                {selectedAction === 'no_answer' && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600">{getConfirmationMessage(selectedAction)}</p>
                  </div>
                )}

                {/* Give Up/Blacklist Reason Selection */}
                {selectedAction === 'status_reason_modal' && (
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-gray-600">{getConfirmationMessage(selectedAction)}</p>
                    
                    <div>
                      <label htmlFor="reason-select" className="block text-sm font-medium text-gray-700 mb-2">
                        Select Reason *
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
                    </div>

                    {/* Custom Reason Input */}
                    {REASON_OPTIONS.find(opt => opt.value === selectedReason)?.customReason && (
                      <div>
                        <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
                          Please specify the reason *
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

                    {/* Additional Notes */}
                    {/* <div>
                      <label htmlFor="additional-notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes (optional)
                      </label>
                      <textarea
                        id="additional-notes"
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="Add any additional notes about this borrower..."
                      />
                    </div> */}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3">
                  {selectedAction && (
                    <button
                      type="button"
                      onClick={() => setSelectedAction('')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  {selectedAction && (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={saving || 
                        (selectedAction === 'follow_up' && !followUpDate) ||
                        (selectedAction === 'status_reason_modal' && (!selectedReason || (REASON_OPTIONS.find(opt => opt.value === selectedReason)?.customReason && !customReasonText.trim())))
                      }
                      className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                        selectedAction === 'status_reason_modal' 
                          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                          : selectedAction === 'follow_up'
                          ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                          : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Confirm Update</span>
                      )}
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 