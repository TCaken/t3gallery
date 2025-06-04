// Modified LeadCard.tsx without drag functionality
"use client";

import { useState, useEffect } from 'react';
import { 
  PencilSquareIcon,
  PhoneIcon,
  UserCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  BookmarkIcon,
  XMarkIcon,
  ClockIcon
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

  const handleAction = (action: string) => {
    console.log('LeadCard: Action clicked:', action);
    console.log('LeadCard: Lead data:', lead);
    
    if (onAction && lead.id) {
      console.log('LeadCard: Calling onAction with:', action, lead.id);
      onAction(action, lead.id);
    }
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
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition ${
        isPinned ? 'border-l-4 border-blue-400' : ''
      }`}
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
            >
              {lead.full_name ?? 'No Name'}
            </a>
          </h3>
          <p className="text-sm text-gray-500 truncate">{lead.phone_number}</p>
        </div>
        
        {/* Status and Tags */}
        <div className="flex flex-col items-end space-y-1 flex-shrink-0">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color}`}>
            {statusInfo.name}
          </span>
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
        {lead.assigned_to && (
          <div className="flex items-center space-x-1 col-span-2">
            <UserCircleIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-blue-600 truncate" title={`Agent: ${lead.assigned_to}`}>
              Agent: {lead.assigned_to}
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
        className="relative"
        onMouseEnter={() => {
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
          <ChatBubbleLeftRightIcon className="h-3 w-3 text-gray-400" />
        </div>
        
        {/* Notes Tooltip */}
        {showNotesTooltip && (
          <div className="absolute right-0 mt-2 w-72 z-10 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
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
        )}
      </div>
    </div>
  );
}