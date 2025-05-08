import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Tag {
  id: number;
  name: string;
  type: string;
  description?: string;
}

interface TagSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tagId: number) => void;
  status: string;
}

const TAG_OPTIONS: Record<string, Tag[]> = {
  'follow_up': [
    { id: 1, name: 'Info Gather', type: 'follow_up', description: 'Need to gather more information' },
    { id: 2, name: 'Callback', type: 'follow_up', description: 'Scheduled callback' },
    { id: 3, name: 'Unsure Appt', type: 'follow_up', description: 'Customer unsure about appointment timing' }
  ],
  'miss/RS': [
    { id: 4, name: 'No Show', type: 'missed_rs', description: 'Customer did not show up' },
    { id: 5, name: 'No Answer', type: 'missed_rs', description: 'Customer not answering calls' },
    { id: 6, name: 'Rescheduled', type: 'missed_rs', description: 'Appointment rescheduled' },
    { id: 7, name: 'Cancelled', type: 'missed_rs', description: 'Appointment cancelled' },
    { id: 8, name: 'Insufficient Docs', type: 'missed_rs', description: 'Missing required documents' }
  ],
  'give_up': [
    { id: 9, name: 'Not Interested', type: 'give_up', description: 'Customer not interested' },
    { id: 10, name: 'Got Another Loan', type: 'give_up', description: 'Customer has another loan' },
    { id: 11, name: 'Low Income', type: 'give_up', description: 'Income requirements not met' },
    { id: 12, name: 'DRS/Bankruptcy/Exclusion', type: 'give_up', description: 'Customer has DRS/Bankruptcy/Exclusion' },
    { id: 13, name: 'No Income Proof', type: 'give_up', description: 'Unable to provide income proof' },
    { id: 14, name: 'Occupation/Unemployed', type: 'give_up', description: 'Occupation issues or unemployed' },
    { id: 15, name: 'Underage', type: 'give_up', description: 'Customer is underage' },
    { id: 16, name: 'High OS', type: 'give_up', description: 'High outstanding loans' },
    { id: 17, name: 'Did not apply', type: 'give_up', description: 'Customer did not complete application' }
  ],
  'blacklisted': [
    { id: 18, name: 'Troublemaker', type: 'blacklisted', description: 'Customer causing issues' },
    { id: 19, name: 'Do Not Call (DNC)', type: 'blacklisted', description: 'Customer requested no contact' },
    { id: 20, name: 'Bad Repayment', type: 'blacklisted', description: 'Poor repayment history' },
    { id: 21, name: 'Foreigner', type: 'blacklisted', description: 'Foreign national restrictions' }
  ],
  'done': [
    { id: 22, name: 'P', type: 'done', description: 'Primary status' },
    { id: 23, name: 'R', type: 'done', description: 'Rescheduled' },
    { id: 24, name: 'PRS', type: 'done', description: 'Primary with reschedule' }
  ]
};

export default function TagSelectionModal({ isOpen, onClose, onConfirm, status }: TagSelectionModalProps) {
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const availableTags = TAG_OPTIONS[status] ?? [];

  useEffect(() => {
    // Reset selection when modal opens
    if (isOpen) {
      setSelectedTag(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Select Tag for {status}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {availableTags.map((tag) => (
            <div
              key={tag.id}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedTag === tag.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedTag(tag.id)}
            >
              <h3 className="font-medium">{tag.name}</h3>
              {tag.description && (
                <p className="text-sm text-gray-600 mt-1">{tag.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedTag && onConfirm(selectedTag)}
            disabled={!selectedTag}
            className={`px-4 py-2 rounded ${
              selectedTag
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
} 