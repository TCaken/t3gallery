"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  PencilSquareIcon,
  PhoneIcon,
  UserCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  BookmarkIcon,
  XMarkIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  CreditCardIcon,
  BanknotesIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { type Borrower } from '~/app/types/borrower';
import { getBorrowerNotes } from '~/app/_actions/borrowerNotes';
import BorrowerStatusUpdateModal from './BorrowerStatusUpdateModal';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Portal } from '@headlessui/react';

// Simple type for status colors
type StatusInfo = {
  id: string;
  name: string;
  color: string;
};

interface BorrowerCardProps {
  borrower: Borrower;
  statusInfo: StatusInfo;
  onAction?: (action: string, borrowerId: number) => void;
  isPinned?: boolean;
  onView: (borrower: Borrower) => void;
}

export default function BorrowerCard({ 
  borrower, 
  statusInfo, 
  onAction,
  isPinned = false,
  onView
}: BorrowerCardProps) {
  const [noteCount, setNoteCount] = useState(0);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [preSelectedStatus, setPreSelectedStatus] = useState<'follow_up' | 'no_answer' | 'give_up' | 'blacklisted' | undefined>(undefined);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  const handleAction = (action: string) => {
    if (onAction && borrower.id) {
      onAction(action, borrower.id);
    }
  };

  // Handle card click to open edit
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' || 
      target.tagName === 'A' || 
      target.closest('button') || 
      target.closest('a') ||
      target.closest('[data-no-card-click]')
    ) {
      return;
    }
    
    handleAction('edit');
  };

  // Handle phone number copy
  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(borrower.phone_number);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy phone number:', err);
    }
  };

  // Function to mask phone number - show only last 4 characters
  const getMaskedPhoneNumber = (phoneNumber: string) => {
    if (phoneNumber.length <= 8) {
      return phoneNumber;
    }
    
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 7);
    
    return `${maskedPart} ${visiblePart}`;
  };

  const loadNotes = async () => {
    if (!borrower.id || loadingNotes || notes.length > 0) return;
    
    setLoadingNotes(true);
    try {
      const result = await getBorrowerNotes({ borrower_id: borrower.id });
      if (result.success) {
        const latestNotes = result.data.slice(-2).map(note => note.content);
        setNotes(latestNotes);
        setNoteCount(result.data.length);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Format dates safely
  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  // Get status badge color for AA status
  const getAAStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'yes':
        return 'bg-green-100 text-green-800';
      case 'no':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get ID type display
  const getIDTypeDisplay = (idType: string) => {
    switch (idType) {
      case 'singapore_nric':
        return 'NRIC';
      case 'singapore_pr':
        return 'PR';
      case 'fin':
        return 'FIN';
      default:
        return idType.toUpperCase();
    }
  };

  // Notification handler
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Status update handlers
  const handleStatusUpdate = (status?: 'follow_up' | 'no_answer' | 'give_up' | 'blacklisted') => {
    setPreSelectedStatus(status);
    setShowStatusModal(true);
  };

  const handleModalClose = () => {
    setShowStatusModal(false);
    setPreSelectedStatus(undefined);
  };

  const handleModalUpdate = () => {
    // Trigger refresh of parent component
    if (onAction) {
      onAction('refresh', borrower.id);
    }
  };

  // Format follow-up date with time awareness
  const formatFollowUpDate = (followUpDate: Date | string | null) => {
    if (!followUpDate) return null;
    
    try {
      const date = typeof followUpDate === 'string' ? parseISO(followUpDate) : followUpDate;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      // Check if time is not default (16:00:00+00 which would be 00:00:00 Singapore time)
      const hasSpecificTime = !(hours === 0 && minutes === 0);
      
      if (hasSpecificTime) {
        return format(date, 'MMM d, yyyy \'at\' h:mm a');
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] ${
        isPinned ? 'border-l-4 border-blue-400' : ''
      }`}
      title="Click to edit borrower details"
    >
      {/* Header Section - Name, Phone, and Primary Status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="text-lg font-medium text-gray-900 truncate group">
            <a 
              href={`/dashboard/borrowers/${borrower.id}`} 
              className="hover:underline"
              title={borrower.full_name}
              data-no-card-click="true"
            >
              {borrower.full_name}
            </a>
          </h3>
          <div className="relative">
            <div className="flex items-center space-x-1">
              <span 
                className="text-sm text-gray-500 font-mono"
                title={`Full number: ${borrower.phone_number}`}
              >
                {getMaskedPhoneNumber(borrower.phone_number)}
              </span>
              <button
                onClick={handlePhoneClick}
                className={`p-1.5 rounded transition-colors duration-200 ${
                  copySuccess 
                    ? 'bg-green-100 text-green-600' 
                    : 'hover:bg-gray-100 text-gray-400 hover:text-blue-600'
                }`}
                title="Click to copy phone number"
              >
                <DocumentDuplicateIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {copySuccess && (
              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-green-600 text-white text-xs rounded shadow-lg z-[5] whitespace-nowrap">
                Phone number copied!
              </div>
            )}
          </div>
        </div>
        
        {/* Status and Tags */}
        <div className="flex flex-col items-end space-y-1 flex-shrink-0">
          {/* AA Status */}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getAAStatusColor(borrower.aa_status)}`}>
            AA: {borrower.aa_status.toUpperCase()}
          </span>
          
          {/* ID Type */}
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-blue-800 bg-blue-100 whitespace-nowrap">
            {getIDTypeDisplay(borrower.id_type)}
          </span>
          
          {/* Loan Status */}
          {borrower.loan_status && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
              borrower.loan_status === 'active' ? 'bg-green-100 text-green-800' :
              borrower.loan_status === 'completed' ? 'bg-blue-100 text-blue-800' :
              borrower.loan_status === 'defaulted' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {borrower.loan_status}
            </span>
          )}
          
          {/* Loan Flags */}
          {borrower.is_bd_loan && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-purple-800 bg-purple-100 whitespace-nowrap">
              BD Loan
            </span>
          )}
          {borrower.is_overdue_loan && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-red-800 bg-red-100 whitespace-nowrap">
              Overdue
            </span>
          )}
          {borrower.is_dnc && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-800 bg-gray-100 whitespace-nowrap">
              DNC
            </span>
          )}
        </div>
      </div>

      {/* Info Grid - Key borrower information */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
        <div className="flex items-center space-x-1">
          <PencilSquareIcon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate" title={`Updated: ${formatDate(borrower.updated_at)}`}>
            {formatDate(borrower.updated_at)}
          </span>
        </div>
        
        {borrower.source && (
          <div className="flex items-center space-x-1">
            <DocumentTextIcon className="h-3 w-3 flex-shrink-0 text-gray-400" />
            <span className="text-gray-600 truncate" title={`Source: ${borrower.source}`}>
              {borrower.source}
            </span>
          </div>
        )}
        
        {borrower.assigned_to && (
          <div className="flex items-center space-x-1 col-span-2">
            <UserCircleIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-blue-600 truncate" title={`Agent: ${borrower.assigned_agent_name ?? borrower.assigned_to}`}>
              {borrower.assigned_agent_name ?? borrower.assigned_to}
            </span>
          </div>
        )}
        
        {borrower.loan_id && (
          <div className="flex items-center space-x-1 col-span-2">
            <IdentificationIcon className="h-3 w-3 flex-shrink-0 text-green-500" />
            <span className="text-green-600 truncate" title={`Loan ID: ${borrower.loan_id}`}>
              {borrower.loan_id}
            </span>
          </div>
        )}
        
        {borrower.follow_up_date && (
          <div className="flex items-center space-x-1 col-span-2">  
            <CalendarIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-blue-600 truncate" title={`Follow Up: ${formatFollowUpDate(borrower.follow_up_date)}`}>
              Follow up {formatFollowUpDate(borrower.follow_up_date)}
            </span>
          </div>
        )}
      </div>

      {/* Loan Information Section */}
      {(borrower.loan_amount ?? borrower.estimated_reloan_amount ?? borrower.credit_score) && (
        <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {borrower.loan_amount && (
              <div className="flex items-center space-x-1">
                <BanknotesIcon className="h-3 w-3 text-green-500" />
                <span className="text-green-700 font-medium">${borrower.loan_amount}</span>
              </div>
            )}
            {borrower.estimated_reloan_amount && (
              <div className="flex items-center space-x-1">
                <CreditCardIcon className="h-3 w-3 text-green-500" />
                <span className="text-green-700">Est: ${borrower.estimated_reloan_amount}</span>
              </div>
            )}
            {borrower.credit_score && (
              <div className="flex items-center space-x-1 col-span-2">
                <span className="text-green-700">Credit Score: {borrower.credit_score}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons - Status Updates */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {/* Call Button */}
            <button
              onClick={() => handleAction('call')}
              className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              title="Make Call"
            >
              <PhoneIcon className="h-4 w-4" />
            </button>
            
            {/* Edit Button */}
            <button
              onClick={() => handleAction('edit')}
              className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              title="Edit Borrower"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Status Update Dropdown */}
          <div className="relative">
            <button
              onClick={() => handleStatusUpdate()}
              className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              title="Update Status"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Status Actions */}
        <div className="flex items-center space-x-1 mt-2">
          <button
            onClick={() => handleStatusUpdate('follow_up')}
            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
            title="Set Follow-up"
          >
            Follow-up
          </button>
          
          <button
            onClick={() => handleStatusUpdate('no_answer')}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            title="Mark No Answer"
          >
            No Answer
          </button>
          
          <button
            onClick={() => handleStatusUpdate('give_up')}
            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
            title="Give Up"
          >
            Give Up
          </button>
          
          <button
            onClick={() => handleStatusUpdate('blacklisted')}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            title="Blacklist"
          >
            Blacklist
          </button>
        </div>
      </div>

      {/* Latest Appointment Section */}
      {borrower.latest_appointment && (
        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-blue-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">
                  Next Appointment
                </span>
                <span className="text-xs text-blue-600">
                  {formatDate(borrower.latest_appointment && typeof borrower.latest_appointment === 'object' && 'start_datetime' in borrower.latest_appointment ? borrower.latest_appointment.start_datetime as string | Date : null)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Section */}
      <div 
        ref={notesRef}
        className="relative"
        onMouseEnter={() => {
          if (notesRef.current) {
            const rect = notesRef.current.getBoundingClientRect();
            setTooltipPosition({
              top: rect.bottom + window.scrollY,
              left: rect.right + window.scrollX - 288,
            });
          }
          setShowNotesTooltip(true);
          void loadNotes();
        }}
        onMouseLeave={() => setShowNotesTooltip(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
            <DocumentTextIcon className="h-3 w-3" />
            <span>Notes</span>
          </div>
        </div>
        
        {/* Loan Notes Preview */}
        {borrower.loan_notes && (
          <div className="mt-1">
            <p className="text-sm text-gray-600 line-clamp-2">
              {borrower.loan_notes}
            </p>
          </div>
        )}
        
        {/* Notes Tooltip */}
        {showNotesTooltip && (
          <Portal>
            <div 
              className="fixed w-72 z-[200] bg-white rounded-lg shadow-lg border border-gray-200"
              style={{
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
              }}
            >
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Latest Notes</h4>
                {loadingNotes ? (
                  <div className="text-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 mx-auto"></div>
                  </div>
                ) : notes.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto">
                    <ul className="space-y-2">
                      {notes.map((note, index) => (
                        <li key={index} className="text-sm text-gray-600 border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2 text-center">No notes available</p>
                )}
              </div>
            </div>
          </Portal>
        )}
      </div>
      
      {/* Status Update Modal */}
      <BorrowerStatusUpdateModal
        isOpen={showStatusModal}
        onClose={handleModalClose}
        borrower={borrower}
        preSelectedStatus={preSelectedStatus}
        onUpdate={handleModalUpdate}
        showNotification={showNotification}
      />

      {/* Notification Toast */}
      {notification && (
        <Portal>
          <div className="fixed top-4 right-4 z-[300] max-w-sm">
            <div className={`rounded-lg shadow-lg p-4 ${
              notification.type === 'success' ? 'bg-green-50 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                  {notification.type === 'error' && <XCircleIcon className="h-5 w-5 text-red-400" />}
                  {notification.type === 'info' && <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-green-800' :
                    notification.type === 'error' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setNotification(null)}
                    className="inline-flex rounded-md p-1.5 hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
} 