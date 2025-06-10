// Modified LeadCard.tsx without drag functionality
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
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { fetchLeadNotes, updateLead } from '~/app/_actions/leadActions';
import LeadActionButtons from './LeadActionButtons';
import LazyComment from './LazyComment';
import LeadEditSlideOver from './LeadEditSlideOver';
import { type Lead } from '~/app/types';
import { formatDistanceToNow } from 'date-fns';
import { Span } from 'next/dist/trace';
import { Portal } from '@headlessui/react';

// Infer lead type from Drizzle schema
type LeadType = InferSelectModel<typeof leads>;

// Simple type for status colors
type StatusInfo = {
  id: string;
  name: string;
  color: string;
};

interface LeadCardProps {
  lead: Lead;
  statusInfo: StatusInfo;
  onAction?: (action: string, leadId: number) => void;
  isPinned?: boolean;
  onView: (lead: Lead) => void;
}

// Helper function to format follow-up date in Singapore time
const formatFollowUpDate = (followUpDate: Date) => {
  // Convert UTC date to Singapore time
  const utcDate = followUpDate;
  const singaporeTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
  
  // Check if it's today in Singapore time
  const today = new Date();
  const todaySingapore = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
  
  const isToday = singaporeTime.toDateString() === todaySingapore.toDateString();
  
  // Check if time is exactly 00:00 in Singapore time
  const isAtMidnight = singaporeTime.getHours() === 0 && singaporeTime.getMinutes() === 0;
  
  if (isToday) {
    if (isAtMidnight) {
      return "Today";
    } else {
      return `Today ${singaporeTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    }
  } else {
    if (isAtMidnight) {
      return singaporeTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: singaporeTime.getFullYear() !== todaySingapore.getFullYear() ? 'numeric' : undefined
      });
    } else {
      return `${singaporeTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: singaporeTime.getFullYear() !== todaySingapore.getFullYear() ? 'numeric' : undefined
      })} ${singaporeTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    }
  }
};

export default function LeadCard({ 
  lead, 
  statusInfo, 
  onAction,
  isPinned = false,
  onView
}: LeadCardProps) {
  const [noteCount, setNoteCount] = useState(0);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const notesRef = useRef<HTMLDivElement>(null);

  const handleAction = (action: string) => {
    // console.log('LeadCard: Action clicked:', action);
    // console.log('LeadCard: Lead data:', lead);
    
    if (onAction && lead.id) {
      // console.log('LeadCard: Calling onAction with:', action, lead.id);
      onAction(action, lead.id);
    }
  };

  // Handle card click to open edit
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    // console.log('LeadCard: handleCardClick', JSON.stringify(lead));
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
    e.stopPropagation(); // Prevent card click
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(lead.phone_number);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy phone number:', err);
    }
  };

  // Function to mask phone number - show only last 5 characters
  const getMaskedPhoneNumber = (phoneNumber: string) => {
    if (phoneNumber.length <= 8) {
      return phoneNumber; // If phone number is 5 characters or less, show as is
    }
    
    const visiblePart = phoneNumber.slice(-4); // Last 5 characters
    const maskedPart = '*'.repeat(phoneNumber.length - 7); // Replace the rest with asterisks
    
    return `${maskedPart} ${visiblePart}`;
  };

  const loadNotes = async () => {
    if (!lead.id || loadingNotes || notes.length > 0) return;
    
    setLoadingNotes(true);
    try {
      const result = await fetchLeadNotes(lead.id);
      if (result.success) {
        setNotes(result.notes.map(note => note.content));
        setNoteCount(result.notes.length);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Load note count on initial render
  useEffect(() => {
    if (lead.id) {
      const fetchNoteCount = async () => {
        try {
          const result = await fetchLeadNotes(lead.id);
          if (result.success) {
            setNoteCount(result.notes.length);
          }
        } catch (error) {
          console.error("Error fetching note count:", error);
        }
      };
      
      void fetchNoteCount();
    }
  }, [lead.id]);

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] ${
        isPinned ? 'border-l-4 border-blue-400' : ''
      }`}
      title="Click to edit lead details"
    >
      {/* Header Section - Name, Phone, and Primary Status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="text-lg font-medium text-gray-900 truncate group">
            <a 
              href={`leads/${lead.id}`} 
              target="_blank" 
              className="hover:underline"
              title={lead.full_name ?? 'No Name'}
              data-no-card-click="true"
            >
              {lead.full_name ?? 'No Name'}
            </a>
          </h3>
          <div className="relative">
            <div className="flex items-center space-x-1">
              <span 
                className="text-sm text-gray-500 font-mono"
                title={`Full number: ${lead.phone_number}`}
              >
                {getMaskedPhoneNumber(lead.phone_number)}
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
          {/* <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color}`}>
            {statusInfo.name}
          </span> */}
          {lead.contact_preference !== "No Preferences" && 
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-yellow-800 bg-yellow-100 whitespace-nowrap">
              {lead.contact_preference}
            </span>
          }
          {lead.communication_language !== "No Preferences" && 
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-teal-800 bg-teal-100 whitespace-nowrap">
              {lead.communication_language}
            </span>
          }
        </div>
      </div>

      {/* Info Grid - More compact layout */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
        <div className="flex items-center space-x-1">
          <PencilSquareIcon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate" title={`Updated: ${formatDistanceToNow(new Date(lead.updated_at ?? ''), { addSuffix: true })}`}>
            {formatDistanceToNow(new Date(lead.updated_at ?? ''), { addSuffix: true })} 
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <ClockIcon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate" title={`Created: ${formatDistanceToNow(new Date(lead.created_at ?? ''), { addSuffix: true })}`}>
            {formatDistanceToNow(new Date(lead.created_at ?? ''), { addSuffix: true })}
          </span>
        </div>
        {lead.source && (
          <div className="flex items-center space-x-1 col-span-2">
            <DocumentTextIcon className="h-3 w-3 flex-shrink-0 text-gray-400" />
            <span className="text-gray-600 truncate" title={`Source: ${lead.source}`}>
              Source: {lead.source}
            </span>
          </div>
        )}
        {lead.assigned_to !== null && (
          <div className="flex items-center space-x-1 col-span-2">
            <UserCircleIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-blue-600 truncate" title={`Agent: ${lead.assigned_to}`}>
              Agent: {lead.assigned_to}
            </span>
          </div>
        )}
        {lead.follow_up_date !== null && (lead.status === "assigned" || lead.status === "no_answer" || lead.status === "follow_up" || lead.status === "missed/RS") && (
          <div className="flex items-center space-x-1 col-span-2">  
            <CalendarIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-blue-600 truncate" title={`Follow Up Date: ${formatFollowUpDate(new Date(lead.follow_up_date ?? ''))}`}>
              {formatFollowUpDate(new Date(lead.follow_up_date ?? ''))}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons - More compact */}
      <div className="mb-3">
        <LeadActionButtons
          leadId={lead.id}
          onAction={handleAction}
          isPinned={isPinned}
          currentStatus={lead.status}
          phoneNumber={lead.phone_number}
          userRole={lead.userRole}
          leadName={lead.full_name ?? undefined}
        />
      </div>

      {/* Notes Section - Compact with icon */}
      <div 
        ref={notesRef}
        className="relative"
        onMouseEnter={() => {
          if (notesRef.current) {
            const rect = notesRef.current.getBoundingClientRect();
            setTooltipPosition({
              top: rect.bottom + window.scrollY,
              left: rect.right + window.scrollX - 288, // 288px = w-72 width
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
            <span>Notes ({noteCount})</span>
          </div>
        </div>
        
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
                <h4 className="font-medium text-gray-900 mb-3">Lead Notes</h4>
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
    </div>
  );
}