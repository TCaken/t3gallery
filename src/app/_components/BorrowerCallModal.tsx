'use client';

import { useState } from 'react';
import { XMarkIcon, PhoneIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { makeBorrowerCall } from '~/app/_actions/borrowerCallActions';

interface BorrowerCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrower: {
    id: number;
    full_name: string;
    phone_number: string;
  } | null;
}

export default function BorrowerCallModal({
  isOpen,
  onClose,
  borrower
}: BorrowerCallModalProps) {
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    message: string;
    callId?: string;
  } | null>(null);

  const handleCall = async () => {
    if (!borrower) return;

    setCalling(true);
    setCallResult(null);

    try {
      const result = await makeBorrowerCall({
        phoneNumber: borrower.phone_number,
        borrowerId: borrower.id,
        borrowerName: borrower.full_name
      });

      setCallResult(result);
    } catch (error) {
      setCallResult({
        success: false,
        message: 'Failed to initiate call'
      });
    } finally {
      setCalling(false);
    }
  };

  const handleClose = () => {
    setCallResult(null);
    onClose();
  };

  if (!isOpen || !borrower) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Call Borrower</h2>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-6">
          <div className="text-center">
            <div className="mb-4">
              <PhoneIcon className="h-12 w-12 text-blue-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-gray-900">{borrower.full_name}</p>
              <p className="text-gray-600">{borrower.phone_number}</p>
            </div>

            {!callResult && !calling && (
              <p className="text-sm text-gray-500 mb-4">
                Click the button below to initiate a call through Samespace
              </p>
            )}

            {calling && (
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Initiating call...</p>
              </div>
            )}

            {callResult && (
              <div className="mb-4">
                <div className="flex items-center justify-center mb-2">
                  {callResult.success ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <p className={`text-sm font-medium ${
                  callResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {callResult.message}
                </p>
                {callResult.callId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Call ID: {callResult.callId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          {!callResult && (
            <button
              onClick={handleCall}
              disabled={calling}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors"
            >
              <PhoneIcon className="h-4 w-4" />
              <span>{calling ? 'Calling...' : 'Call Now'}</span>
            </button>
          )}
          
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {callResult ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
} 