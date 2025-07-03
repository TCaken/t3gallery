'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getAvailableTemplates } from '~/app/_actions/whatsappActions';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { createBorrowerAction } from '~/app/_actions/borrowerNotes';
import { updateBorrower } from '~/app/_actions/borrowers';

interface WhatsAppTemplate {
  id: number;
  template_id: string | null;
  name: string;
  description: string | null;
  customer_type: string;
  supported_methods: ('sms' | 'whatsapp' | 'both')[];
  default_method: string | null;
  is_active: boolean;
}

type DeliveryMethod = 'sms' | 'whatsapp' | 'both';

interface BorrowerInfo {
  id: number;
  full_name: string;
  phone_number: string;
}

interface BorrowerWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowers: BorrowerInfo[]; // Single or multiple borrowers
  isBulkMode?: boolean;
  onSuccess?: () => void;
}

export default function BorrowerWhatsAppModal({
  isOpen,
  onClose,
  borrowers,
  isBulkMode = false,
  onSuccess
}: BorrowerWhatsAppModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('whatsapp');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{
    success: number;
    failed: number;
    details: Array<{ borrower: string; success: boolean; error?: string }>
  } | null>(null);
  
  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setSendResults(null);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // Only fetch reloan customer templates
      const result = await getAvailableTemplates('reloan');
      if (result.success) {
        // Map the templates to match our interface
        const mappedTemplates = result.templates?.map(template => ({
          ...template,
          supported_methods: (template.supported_methods as ('sms' | 'whatsapp' | 'both')[]) ?? ['whatsapp'],
          is_active: template.auto_send ?? true // Use auto_send as active status fallback
        })) ?? [];
        setTemplates(mappedTemplates);
      } else {
        console.error('Failed to load templates:', result.error);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  if (!isOpen) return null;

  const handleTemplateSelect = (templateId: number) => {
    setSelectedTemplate(templateId);
    // Find the template and set default delivery method
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Default to WhatsApp if supported, otherwise first available method
      if (template.supported_methods.includes('whatsapp')) {
        setDeliveryMethod('whatsapp');
      } else if (template.supported_methods.length > 0) {
        const firstMethod = template.supported_methods[0];
        if (firstMethod) {
          setDeliveryMethod(firstMethod);
        }
      }
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || borrowers.length === 0) return;
    
    setSending(true);
    const results: Array<{ borrower: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const borrower of borrowers) {
        try {
          // Send WhatsApp message
          const result = await sendWhatsAppMessage(
            borrower.phone_number,
            selectedTemplate,
            {},
            deliveryMethod,
            borrower.id // Pass borrower ID as leadId for template parameter resolution
          );
          
          if (result.success) {
            successCount++;
            results.push({ borrower: borrower.full_name, success: true });
            
            // Add note to borrower record
            const template = templates.find(t => t.id === selectedTemplate);
            const noteContent = `WhatsApp message sent using template "${template?.name ?? 'Unknown'}" via ${deliveryMethod.toUpperCase()}`;
            await createBorrowerAction({
              borrower_id: borrower.id,
              content: noteContent,
              action_type: 'communication'
            });
          } else {
            failedCount++;
            results.push({ 
              borrower: borrower.full_name, 
              success: false, 
              error: result.error ?? 'Unknown error' 
            });
          }
        } catch (error) {
          failedCount++;
          results.push({ 
            borrower: borrower.full_name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      setSendResults({
        success: successCount,
        failed: failedCount,
        details: results
      });

      if (successCount > 0) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error in bulk send:', error);
    } finally {
      setSending(false);
    }
  };

  const getMethodLabel = (method: DeliveryMethod): string => {
    switch (method) {
      case 'sms': return 'SMS';
      case 'whatsapp': return 'WhatsApp';
      case 'both': return 'SMS & WhatsApp';
      default: return '';
    }
  };

  const handleClose = () => {
    setSendResults(null);
    setSelectedTemplate(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={handleClose}
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold mb-2">
          {isBulkMode ? 'Send Bulk WhatsApp Messages' : 'Send WhatsApp Message'}
        </h3>
        
        <p className="text-sm text-gray-500 mb-4">
          {isBulkMode 
            ? `Send message to ${borrowers.length} selected borrower${borrowers.length > 1 ? 's' : ''}`
            : `Send message to ${borrowers[0]?.full_name} (${borrowers[0]?.phone_number})`
          }
        </p>

                 {/* Show results if available */}
         {sendResults ? (
           <div className="mb-4 p-4 border rounded-lg">
             <h4 className="font-medium mb-2">Send Results</h4>
             <div className="space-y-1 text-sm">
               <p className="text-green-600">✅ Success: {sendResults.success}</p>
               <p className="text-red-600">❌ Failed: {sendResults.failed}</p>
             </div>
             
             {sendResults.details.length > 0 && (
               <div className="mt-3 max-h-32 overflow-y-auto">
                 <div className="text-xs space-y-1">
                   {sendResults.details.map((detail, index) => (
                     <div key={index} className={`flex justify-between ${detail.success ? 'text-green-600' : 'text-red-600'}`}>
                       <span>{detail.borrower}</span>
                       <span>{detail.success ? '✅' : '❌'}</span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             
             <button
               onClick={handleClose}
               className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
             >
               Close
             </button>
           </div>
         ) : (
           <>
         
         <div className="space-y-4 mb-4">
           <p className="font-medium text-sm text-gray-700">Select Reloan Customer Template:</p>
           
           {loadingTemplates ? (
             <div className="flex justify-center py-8">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
             </div>
           ) : (
             <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
               {templates.length > 0 ? (
                 templates.map((template) => (
                   <div
                     key={template.id}
                     onClick={() => handleTemplateSelect(template.id)}
                     className={`p-4 ${
                       selectedTemplate === template.id 
                         ? 'bg-blue-50 border-l-4 border-blue-500' 
                         : 'hover:bg-gray-50'
                     } cursor-pointer transition-colors`}
                   >
                     <div className="flex justify-between">
                       <h4 className="font-medium text-gray-900">{template.name}</h4>
                       <div className="flex gap-1">
                         <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Reloan</span>
                         <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>
                       </div>
                     </div>
                     {template.description && (
                       <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                     )}
                     <div className="flex gap-2 mt-2">
                       {template.supported_methods.map(method => (
                         <span 
                           key={method} 
                           className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                         >
                           {getMethodLabel(method)}
                         </span>
                       ))}
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="p-8 text-center text-gray-500">
                   <p>No reloan customer templates found</p>
                   <p className="text-xs mt-1">Please create templates for reloan customers first</p>
                 </div>
               )}
             </div>
           )}
         </div>
         
         {selectedTemplate && (
           <div className="space-y-4 mb-6">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Delivery Method:
               </label>
               <select
                 value={deliveryMethod}
                 onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}
                 className="block w-full rounded-md border-gray-300 shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500"
               >
                 {templates
                   .find(t => t.id === selectedTemplate)
                   ?.supported_methods.map(method => (
                     <option key={method} value={method}>
                       {getMethodLabel(method)}
                     </option>
                   )) ?? (
                     <option value="whatsapp">WhatsApp</option>
                   )}
               </select>
             </div>
           </div>
         )}
         
         <div className="flex justify-end space-x-3">
           <button 
             onClick={handleClose}
             className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
             disabled={sending}
           >
             Cancel
           </button>
           <button 
             onClick={handleSend}
             disabled={!selectedTemplate || sending}
             className={`px-4 py-2 text-white rounded-md ${
               selectedTemplate && !sending
                 ? 'bg-blue-600 hover:bg-blue-700' 
                 : 'bg-blue-300 cursor-not-allowed'
             }`}
           >
             {sending 
               ? `Sending ${isBulkMode ? `(${borrowers.length})` : ''}...` 
               : `Send ${isBulkMode ? `to ${borrowers.length} Borrowers` : 'Message'}`
             }
           </button>
         </div>
         </>
         )}
      </div>
    </div>
  );
} 

