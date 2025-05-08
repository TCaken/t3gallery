// Modified LeadCard.tsx without drag functionality
"use client";

import { useState, useEffect } from 'react';
import { 
  PhoneIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  BookmarkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { fetchLeadNotes } from '~/app/_actions/leadActions';
import LeadActionButtons from './LeadActionButtons';
import LazyComment from './LazyComment';

// Infer lead type from Drizzle schema
type Lead = InferSelectModel<typeof leads>;

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
  tag?: { id: number; name: string } | null;
}

export default function LeadCard({ 
  lead, 
  statusInfo, 
  onAction,
  isPinned = false,
  onView,
  tag
}: LeadCardProps) {
  const [noteCount, setNoteCount] = useState(0);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleAction = (action: string) => {
    console.log('LeadCard: Action clicked:', action);
    console.log('LeadCard: Lead data:', lead);
    
    if (onAction && lead.id) {
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

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      assigned: "bg-cyan-100 text-cyan-800",
      no_answer: "bg-gray-100 text-gray-800",
      follow_up: "bg-indigo-100 text-indigo-800",
      P: "bg-emerald-100 text-emerald-800",
      PRS: "bg-teal-100 text-teal-800",
      R: "bg-violet-100 text-violet-800",
      "miss/RS": "bg-pink-100 text-pink-800",
      booked: "bg-green-100 text-green-800",
      unqualified: "bg-orange-100 text-orange-800",
      give_up: "bg-red-100 text-red-800",
      blacklisted: "bg-black text-white",
    };
    return statusMap[status] ?? "bg-gray-100 text-gray-800";
  };

  const getTagColor = (status: string) => {
    const tagColorMap: Record<string, string> = {
      follow_up: "bg-indigo-50 text-indigo-700 border-indigo-200",
      "miss/RS": "bg-pink-50 text-pink-700 border-pink-200",
      give_up: "bg-red-50 text-red-700 border-red-200",
      blacklisted: "bg-gray-50 text-gray-700 border-gray-200",
      done: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
    return tagColorMap[status] ?? "bg-gray-50 text-gray-700 border-gray-200";
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition ${
        isPinned ? 'border-l-4 border-blue-400' : ''
      }`}
      onClick={() => onView(lead)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-medium">
            {lead.first_name} {lead.last_name}
            {isPinned && (
              <BookmarkIcon className="h-4 w-4 ml-1 inline-block text-blue-500" />
            )}
          </h4>
          <p className="text-sm text-gray-600">{lead.phone_number}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(lead.status)}`}>
              {lead.status}
            </span>
            {tag && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getTagColor(lead.status)}`}>
                {tag.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Email:</span> {lead.email ?? 'N/A'}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Source:</span> {lead.source ?? 'N/A'}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Created:</span>{' '}
          {new Date(lead.created_at).toLocaleDateString()}
        </p>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="mb-3">
        <LeadActionButtons
          leadId={lead.id}
          onAction={handleAction}
          isPinned={isPinned}
          currentStatus={lead.status}
          phoneNumber={lead.phone_number}
        />
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <LazyComment leadId={lead.id} />
      </div>
    </div>
  );
}