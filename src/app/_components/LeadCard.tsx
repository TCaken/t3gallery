// Modified LeadCard.tsx with appointment button
"use client";

import { useState, useEffect } from 'react';
import { 
  PhoneIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { fetchLeadNotes } from '~/app/_actions/leadActions';

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
  draggable?: boolean;
  onDragStart?: () => void;
}

export default function LeadCard({ 
  lead, 
  statusInfo, 
  onAction,
  draggable = false,
  onDragStart 
}: LeadCardProps) {
  const [noteCount, setNoteCount] = useState(0);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

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

  return (
    <div 
      className="bg-white p-3 rounded-lg shadow-sm mb-2 cursor-pointer hover:shadow-md relative"
      onClick={() => handleAction('view')}
      draggable={draggable}
      onDragStart={onDragStart}
      onMouseEnter={() => void loadNotes()}
    >
      {/* Basic lead info */}
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium">
          {lead.first_name !== '-' ? lead.first_name : ''} {lead.last_name !== '-' ? lead.last_name : ''}
        </h4>
        <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
          {statusInfo.name}
        </span>
      </div>
      
      <div className="text-sm text-gray-600 mb-1">{lead.phone_number}</div>
      <div className="text-sm text-gray-600 mb-2">{lead.email ?? 'No email'}</div>
      <div className="text-xs text-gray-500 mb-3">
        Source: {lead.source ?? 'Unknown'}
      </div>
      
      {/* Basic action buttons */}
      <div className="flex justify-between border-t pt-2">
        <div className="flex gap-3">
          <button 
            className="text-gray-500 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('make_call');
            }}
          >
            <PhoneIcon className="h-4 w-4" />
          </button>
          <button 
            className="text-gray-500 hover:text-green-600"
            onClick={(e) => {
              e.stopPropagation();
              console.log('WhatsApp button clicked');
              console.log('Phone number:', lead.phone_number);
              handleAction('send_whatsapp');
            }}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
          </button>
          <div className="relative z-30">
            <button 
              className="text-gray-500 hover:text-blue-600 relative"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('add_note');
              }}
              onMouseEnter={() => setShowNotesTooltip(true)}
              onMouseLeave={() => setShowNotesTooltip(false)}
            >
              <DocumentTextIcon className="h-4 w-4" />
              {noteCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {noteCount}
                </span>
              )}
            </button>
            
            {/* Notes tooltip - Fixed positioning */}
            {showNotesTooltip && noteCount > 0 && (
              <div className="fixed transform -translate-y-full -translate-x-1/2 z-50 mt-1 w-64 bg-white rounded-lg shadow-xl p-3 text-sm border border-gray-200">
                <div className="font-medium mb-1">Notes ({noteCount})</div>
                <div className="max-h-40 overflow-y-auto">
                  {loadingNotes ? (
                    <p className="text-gray-500">Loading notes...</p>
                  ) : notes.length > 0 ? (
                    notes.map((note, index) => (
                      <div key={index} className="mb-2 pb-2 border-b border-gray-100 last:border-0">
                        <p className="text-gray-700 line-clamp-2">{note}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No notes available</p>
                  )}
                </div>
                <div className="absolute w-3 h-3 bg-white transform rotate-45 left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2 border-r border-b border-gray-200"></div>
              </div>
            )}
          </div>
          {/* New Calendar/Appointment Button with special color */}
          <button 
            className="text-indigo-600 hover:text-indigo-800"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('schedule_appointment');
            }}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}