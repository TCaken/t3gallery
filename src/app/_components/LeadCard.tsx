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
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleAction = (action: string) => {
    console.log('LeadCard: Action clicked:', action);
    console.log('LeadCard: Lead data:', lead);
    
    if (action === 'edit') {
      setIsEditOpen(true);
      return;
    }
    
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

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    if (onView) {
      onView(lead);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition ${
        isPinned ? 'border-l-4 border-blue-400' : ''
      } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            <a href={`leads/${lead.id}`} target="_blank" className="hover:underline">
              {lead.full_name ?? 'No Name'}
            </a>
          </h3>
          <p className="text-sm text-gray-500">{lead.phone_number}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.name}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex flex-col text-sm text-gray-500">
          <span>Created: {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
          {lead.assigned_to && (
            <span className="text-blue-600">Assigned to: {lead.assigned_to}</span>
          )}
        </div>
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

      {isExpanded && (
        <div className="mt-4 border-t pt-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.email ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Residential Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.residential_status ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Employment Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.employment_status ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Loan Purpose</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.loan_purpose ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Existing Loans</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.existing_loans ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.amount ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Source</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.source ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Lead Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{lead.lead_type ?? 'Not provided'}</dd>
            </div>
          </dl>
        </div>
      )}
      <div 
        className="relative"
        onMouseEnter={() => {
          setShowNotesTooltip(true);
          void loadNotes();
        }}
        onMouseLeave={() => setShowNotesTooltip(false)}
      >
        <div className="flex items-center">
          <span className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            Hover to view notes ({noteCount})
          </span>
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
                <ul className="space-y-3">
                  {notes.map((note, index) => (
                    <li key={index} className="text-sm text-gray-600 border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 py-2">No notes available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}