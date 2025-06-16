'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getUserRoles } from '~/server/rbac/queries';
import {
  ChatBubbleLeftIcon,
  PhoneIcon,
  PaperAirplaneIcon,
  BookmarkIcon,
  EllipsisHorizontalIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  InformationCircleIcon,
  UserPlusIcon,
  CalendarDaysIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import {
  ChatBubbleLeftIcon as ChatBubbleLeftSolidIcon,
  PhoneIcon as PhoneSolidIcon,
  PaperAirplaneIcon as PaperAirplaneSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
  CalendarDaysIcon as CalendarDaysSolidIcon,
  InformationCircleIcon as InformationCircleSolidIcon,
  UserPlusIcon as UserPlusSolidIcon,
  PencilSquareIcon as PencilSquareSolidIcon
} from '@heroicons/react/24/solid';
import CallModal from './CallModal';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { Fragment } from 'react';
import { Transition, Portal } from '@headlessui/react';


interface ActionButton {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  solidIcon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface LeadActionButtonsProps {
  leadId: number;
  onAction: (action: string, leadId: number) => void;
  isPinned: boolean;
  currentStatus?: string;
  phoneNumber: string;
  userRole?: string;
  leadName?: string;
}

export default function LeadActionButtons({
  leadId,
  onAction,
  isPinned,
  currentStatus,
  phoneNumber,
  userRole = 'user',
  leadName,
}: LeadActionButtonsProps) {
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
      onAction(action, leadId);
    } finally {
      setIsLoading(false);
      setIsMenuOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <UserIcon className="h-4 w-4" />;
      case 'assigned':
        return <UserIcon className="h-4 w-4" />;
      case 'no_answer':
        return <PhoneIcon className="h-4 w-4 text-gray-500" />;
      case 'follow_up':
        return <ClockIcon className="h-4 w-4 text-blue-500" />;
      case 'booked':
        return <CalendarIcon className="h-4 w-4 text-green-500" />;
      case 'done':
        return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
      case 'missed/RS':
        return <XCircleIcon className="h-4 w-4 text-pink-500" />;
      case 'unqualified':
        return <XCircleIcon className="h-4 w-4 text-orange-500" />;
      case 'give_up':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'blacklisted':
        return <XCircleIcon className="h-4 w-4 text-black" />;
      default:
        return <ArrowPathIcon className="h-4 w-4" />;
    }
  };

  // Define statuses that agents can move leads to
  const agentAllowedStatuses = [
    { id: 'assigned', label: 'Assigned' },
    { id: 'no_answer', label: 'No Answer' },
    { id: 'follow_up', label: 'Follow Up' },
    { id: 'booked', label: 'Booked' },
    { id: 'done', label: 'Done' },
    { id: 'missed/RS', label: 'Missed/RS' },
    { id: 'unqualified', label: 'Unqualified' },
    { id: 'give_up', label: 'Give Up' },
    { id: 'blacklisted', label: 'Blacklisted' },
  ];

  // All status options
  const allStatusOptions = [
    { id: 'new', label: 'New' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'no_answer', label: 'No Answer' },
    { id: 'follow_up', label: 'Follow Up' },
    { id: 'booked', label: 'Booked' },
    { id: 'done', label: 'Done' },
    { id: 'missed/RS', label: 'Missed/RS' },
    { id: 'unqualified', label: 'Unqualified' },
    { id: 'give_up', label: 'Give Up' },
    { id: 'blacklisted', label: 'Blacklisted' },
  ];

  // Filter status options based on current status and user role
  const isAdmin = userRole === 'admin';
  const statusOptions = (isAdmin ? allStatusOptions : agentAllowedStatuses)
    .filter(status => status.id !== currentStatus);

  const buttons: ActionButton[] = [
    {
      id: 'edit',
      icon: PencilSquareIcon,
      solidIcon: PencilSquareSolidIcon,
      title: 'Edit Lead',
      onClick: () => handleAction('edit')
    },
    {
      id: 'call',
      icon: PhoneIcon,
      solidIcon: PhoneSolidIcon,
      title: 'Make Call',
      onClick: () => setIsCallModalOpen(true),
    },
    {
      id: 'assign',
      icon: UserPlusIcon,
      solidIcon: UserPlusSolidIcon,
      title: 'Assign to Agent',
      onClick: () => handleAction('assign')
    },
    {
      id: 'whatsapp',
      icon: ChatBubbleLeftIcon,
      solidIcon: ChatBubbleLeftSolidIcon,
      title: 'Send WhatsApp',
      onClick: () => handleAction('whatsapp'),
    },
    {
      id: 'calendar',
      icon: CalendarDaysIcon,
      solidIcon: CalendarDaysSolidIcon,
      title: 'Schedule Appointment',
      onClick: () => router.push(`/dashboard/leads/${leadId}/appointment`),
      disabled: false,
    },
    // {
    //   id: 'pin',
    //   icon: BookmarkIcon,
    //   solidIcon: BookmarkSolidIcon,
    //   title: isPinned ? 'Unpin Lead' : 'Pin Lead',
    //   onClick: () => handleAction(isPinned ? 'unpin' : 'pin'),
    //   active: isPinned,
    // },
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
        leadName={leadName}
      />
    </>
  );
} 