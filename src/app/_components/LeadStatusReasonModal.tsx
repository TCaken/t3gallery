"use client";

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LeadStatusReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, finalStatus: 'give_up' | 'blacklisted') => void;
  leadName: string;
}

interface ReasonOption {
  value: string;
  label: string;
  finalStatus: 'give_up' | 'blacklisted';
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'blacklisted_do_not_call', label: 'Blacklisted - Do Not Call', finalStatus: 'blacklisted' },
  { value: 'blacklisted_others', label: 'Blacklisted - Others', finalStatus: 'blacklisted' },
  { value: 'give_up_trouble_maker', label: 'Give Up - Trouble Maker', finalStatus: 'give_up' },
  { value: 'give_up_already_got_loan', label: 'Give Up - Already Got Loan', finalStatus: 'give_up' },
  { value: 'give_up_income_too_low', label: 'Give Up - Income Too Low', finalStatus: 'give_up' },
  { value: 'give_up_not_enough_age', label: 'Give Up - Not Enough Age', finalStatus: 'give_up' },
];

export default function LeadStatusReasonModal({
  isOpen,
  onClose,
  onConfirm,
  leadName
}: LeadStatusReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedReason) return;

    const reasonOption = REASON_OPTIONS.find(option => option.value === selectedReason);
    if (!reasonOption) return;

    setIsSubmitting(true);
    try {
      onConfirm(selectedReason, reasonOption.finalStatus);
      onClose();
      setSelectedReason('');
    } catch (error) {
      console.error('Error updating lead status:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedReason('');
  };

  const selectedReasonOption = REASON_OPTIONS.find(option => option.value === selectedReason);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Update Lead Status</h2>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Please select a reason for updating the status of <strong>{leadName}</strong>:
          </p>
          
          <div className="mb-4">
            <label htmlFor="reason-select" className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <select
              id="reason-select"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              disabled={isSubmitting}
            >
              <option value="">Select a reason...</option>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {selectedReasonOption && (
            <div className={`p-3 rounded-lg ${
              selectedReasonOption.finalStatus === 'blacklisted' 
                ? 'bg-red-50 border border-red-200' 
                : 'bg-orange-50 border border-orange-200'
            }`}>
              <p className="text-sm font-medium">
                Lead will be moved to: 
                <span className={`ml-1 px-2 py-1 rounded text-xs font-semibold ${
                  selectedReasonOption.finalStatus === 'blacklisted'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-orange-100 text-orange-800'
                }`}>
                  {selectedReasonOption.finalStatus === 'blacklisted' ? 'Blacklisted' : 'Give Up'}
                </span>
              </p>
            </div>
          )}
        </div>
        
        <div className="flex space-x-4 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || isSubmitting}
            className={`px-4 py-2 rounded text-white flex items-center ${
              !selectedReason || isSubmitting
                ? 'bg-gray-300 cursor-not-allowed'
                : selectedReasonOption?.finalStatus === 'blacklisted'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 