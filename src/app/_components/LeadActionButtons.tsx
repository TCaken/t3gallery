'use client';

import { useState } from 'react';
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
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import {
  ChatBubbleLeftIcon as ChatBubbleLeftSolidIcon,
  PhoneIcon as PhoneSolidIcon,
  PaperAirplaneIcon as PaperAirplaneSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
  CalendarDaysIcon as CalendarDaysSolidIcon,
  InformationCircleIcon as InformationCircleSolidIcon,
  UserPlusIcon as UserPlusSolidIcon
} from '@heroicons/react/24/solid';
import CustomWhatsAppModal from './CustomWhatsAppModal';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';

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
}

export default function LeadActionButtons({
  leadId,
  onAction,
  isPinned,
  currentStatus,
  phoneNumber,
  userRole = 'user',
}: LeadActionButtonsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const { userId } = useAuth();
  const router = useRouter();

  const handleAction = (action: string) => {
    setIsLoading(true);
    try {
      onAction(action, leadId);
    } finally {
      setIsLoading(false);
      setIsMenuOpen(false);
    }
  };

  const handleWhatsAppSend = async (
    templateId: string, 
    parameters: Record<string, string>,
    deliveryMethod: 'sms' | 'whatsapp' | 'both' = 'whatsapp'
  ) => {
    // Actually send the WhatsApp message
    const result = await sendWhatsAppMessage(phoneNumber, templateId, parameters, deliveryMethod);
    console.log('Message send result:', result);
    // Optionally, you can show a toast or call onAction if you want to update UI
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
      id: 'info',
      icon: InformationCircleIcon,
      solidIcon: InformationCircleSolidIcon,
      title: 'View Lead Details',
      onClick: () => router.push(`/dashboard/leads/${leadId}`),
      disabled: false,
    },
    {
      id: 'assign',
      icon: UserPlusIcon,
      solidIcon: UserPlusSolidIcon,
      title: 'Assign to Agent',
      onClick: () => handleAction('assign'),
      disabled: userRole !== 'admin',
    },
    {
      id: 'call',
      icon: PhoneIcon,
      solidIcon: PhoneSolidIcon,
      title: 'Make Call',
      onClick: () => handleAction('call'),
      disabled: true,
    },
    {
      id: 'whatsapp',
      icon: ChatBubbleLeftIcon,
      solidIcon: ChatBubbleLeftSolidIcon,
      title: 'Send WhatsApp',
      onClick: () => setIsWhatsAppModalOpen(true),
    },
    {
      id: 'calendar',
      icon: CalendarDaysIcon,
      solidIcon: CalendarDaysSolidIcon,
      title: 'Schedule Appointment',
      onClick: () => router.push(`/dashboard/leads/${leadId}/appointment`),
      disabled: false,
    },
    {
      id: 'pin',
      icon: BookmarkIcon,
      solidIcon: BookmarkSolidIcon,
      title: isPinned ? 'Unpin Lead' : 'Pin Lead',
      onClick: () => handleAction(isPinned ? 'unpin' : 'pin'),
      active: isPinned,
    },
  ];

  return (
    <>
      <div className="flex items-center space-x-1">
        {buttons.map((button) => (
          <button
            key={button.id}
            onClick={button.onClick}
            disabled={button.disabled ?? isLoading}
            title={button.title}
            className={`p-2 rounded-full transition-all duration-200 ${
              button.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : button.active
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {button.active ? (
              <button.solidIcon className="h-4 w-4" />
            ) : (
              <button.solidIcon className="h-4 w-4" />
            )}
          </button>
        ))}
        
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-full transition-all duration-200 ${
              isMenuOpen
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="More Actions"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                  Move to Status
                </div>
                {statusOptions.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => handleAction(`move_to_${status.id}`)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    {getStatusIcon(status.id)}
                    <span className="ml-2">{status.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CustomWhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        onSend={handleWhatsAppSend}
        phoneNumber={phoneNumber}
      />
    </>
  );
} 