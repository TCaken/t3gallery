"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  DocumentTextIcon,
  BookmarkIcon,
  BookmarkSlashIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline';
import {
  PhoneIcon as PhoneIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  CalendarIcon as CalendarIconSolid,
  DocumentTextIcon as DocumentIconSolid,
  BookmarkIcon as BookmarkIconSolid,
} from '@heroicons/react/24/solid';
import CallModal from './CallModal';
import { updateBorrower } from '~/app/_actions/borrowers';

interface BorrowerActionButtonsProps {
  borrowerId: number;
  onAction: (action: string, borrowerId: number) => void;
  isPinned: boolean;
  currentStatus?: string;
  phoneNumber: string;
  userRole?: string;
  borrowerName?: string;
  onSuccess?: () => void;
}

export default function BorrowerActionButtons({
  borrowerId,
  onAction,
  isPinned,
  currentStatus,
  phoneNumber,
  userRole = 'user',
  borrowerName,
  onSuccess
}: BorrowerActionButtonsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        menuButtonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  const handleAction = (action: string) => {
    setIsLoading(true);
    try {
      onAction(action, borrowerId);
    } finally {
      setIsLoading(false);
      setIsMenuOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircleIcon className="h-4 w-4 text-gray-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-blue-500" />;
      case 'defaulted':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'restructured':
        return <ArrowPathIcon className="h-4 w-4 text-orange-500" />;
      default:
        return <ArrowPathIcon className="h-4 w-4" />;
    }
  };

  // Define statuses that agents can move borrowers to
  const agentAllowedStatuses = [
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'completed', label: 'Completed' },
    { id: 'defaulted', label: 'Defaulted' },
    { id: 'restructured', label: 'Restructured' },
  ];

  // Define quick action buttons
  const buttons = [
    {
      id: 'call',
      icon: PhoneIcon,
      solidIcon: PhoneIconSolid,
      title: 'Make Call',
      active: false,
      disabled: false,
      onClick: () => setIsCallModalOpen(true)
    },
    {
      id: 'whatsapp',
      icon: ChatBubbleLeftRightIcon,
      solidIcon: ChatIconSolid,
      title: 'Send WhatsApp',
      active: false,
      disabled: false,
      onClick: () => handleAction('whatsapp')
    },
    {
      id: 'schedule',
      icon: CalendarIcon,
      solidIcon: CalendarIconSolid,
      title: 'Schedule Appointment',
      active: false,
      disabled: false,
      onClick: () => handleAction('schedule_appointment')
    },
    {
      id: 'notes',
      icon: DocumentTextIcon,
      solidIcon: DocumentIconSolid,
      title: 'Add Note',
      active: false,
      disabled: false,
      onClick: () => handleAction('add_note')
    },
    {
      id: 'pin',
      icon: isPinned ? BookmarkSlashIcon : BookmarkIcon,
      solidIcon: BookmarkIconSolid,
      title: isPinned ? 'Unpin Borrower' : 'Pin Borrower',
      active: isPinned,
      disabled: false,
      onClick: () => handleAction(isPinned ? 'unpin' : 'pin')
    }
  ];

  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);

  const handleStatusUpdate = async (newStatus: string, actionLabel: string) => {
    setStatusUpdateLoading(newStatus);
    try {
      const result = await updateBorrower({
        id: borrowerId,
        status: newStatus
      });

      if (result.success) {
        onSuccess?.();
      }
    } catch (error) {
      console.error(`Error updating status to ${newStatus}:`, error);
    } finally {
      setStatusUpdateLoading(null);
    }
  };

  const actions = [
    {
      status: 'follow_up',
      label: 'Follow Up',
      icon: PhoneIcon,
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Mark for follow-up'
    },
    {
      status: 'no_answer',
      label: 'No Answer',
      icon: ExclamationTriangleIcon,
      color: 'bg-yellow-600 hover:bg-yellow-700',
      description: 'No response from borrower'
    },
    {
      status: 'give_up',
      label: 'Give Up',
      icon: NoSymbolIcon,
      color: 'bg-red-600 hover:bg-red-700',
      description: 'Stop pursuing this borrower'
    },
    {
      status: 'blacklisted',
      label: 'Blacklist',
      icon: HandRaisedIcon,
      color: 'bg-gray-800 hover:bg-gray-900',
      description: 'Blacklist this borrower'
    }
  ];

  return (
    <>
      <div className="flex items-center space-x-1">
        {buttons.map((button) => (
          <button
            key={button.id}
            onClick={button.onClick}
            disabled={isLoading || button.disabled}
            title={button.title}
            className={`p-2 rounded-full transition-all duration-200 ${
              button.active
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {button.active ? (
              <button.solidIcon className="h-4 w-4" />
            ) : (
              <button.icon className="h-4 w-4" />
            )}
          </button>
        ))}
      </div>

      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        onConfirm={() => handleAction('call')}
        phoneNumber={phoneNumber}
        leadName={borrowerName}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <p className="text-sm text-gray-600 mb-4">
          Current Status: <span className="font-medium capitalize">{currentStatus?.replace('_', ' ')}</span>
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const isCurrentStatus = currentStatus === action.status;
                         const isActionLoading = statusUpdateLoading === action.status;
            
            return (
              <button
                key={action.status}
                onClick={() => handleStatusUpdate(action.status, action.label)}
                                 disabled={isCurrentStatus || isActionLoading}
                title={isCurrentStatus ? "Current status" : action.description}
                className={`
                  flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-white text-sm font-medium transition-all
                                     ${isCurrentStatus ? 'bg-gray-400 cursor-not-allowed opacity-60' : isActionLoading ? 'bg-gray-400 cursor-not-allowed' : action.color}
                `}
              >
                <action.icon className="h-4 w-4" />
                <span>
                                     {isActionLoading ? 'Updating...' : action.label}
                </span>
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-gray-500 mt-3">
          💡 Tip: These actions will update the borrower status and log the change
        </p>
      </div>
    </>
  );
} 