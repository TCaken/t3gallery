'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getAllWhatsAppTemplates } from '~/app/_actions/templateManagementActions';
import { sendManualWhatsAppWorkflow } from '~/app/_actions/transactionOrchestrator';

interface WhatsAppTemplate {
  id: number;
  template_id: string;
  name: string;
  description: string | null;
  supported_methods: ('sms' | 'whatsapp' | 'both')[];
  is_active: boolean;
}

type DeliveryMethod = 'sms' | 'whatsapp' | 'both';

interface CustomWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend?: (templateId: string, parameters: Record<string, string>, deliveryMethod?: 'sms' | 'whatsapp' | 'both') => Promise<void>;
  phoneNumber: string;
  leadId: number;
}

export default function CustomWhatsAppModal({
  isOpen,
  onClose,
  onSend,
  phoneNumber,
  leadId
}: CustomWhatsAppModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('whatsapp');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const result = await getAllWhatsAppTemplates();
      if (result.success) {
        setTemplates(result.templates.filter(t => t.is_active)); // Only show active templates
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
    if (!selectedTemplate) return;
    
    setSending(true);
    try {
      // Use the new orchestrated workflow
      const result = await sendManualWhatsAppWorkflow({
        phone: phoneNumber,
        templateDatabaseId: selectedTemplate,
        parameters: {},
        deliveryMethod,
        leadId: leadId
      });
      
      if (result.success) {
        alert('Message sent successfully!');
        onClose();
    } else {
        alert(`Failed to send message: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('An error occurred while sending the message');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 animate-fade-in">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold mb-2">Send Message</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select a template to send a message to {phoneNumber}
        </p>
        
        <div className="space-y-4 mb-4">
          <p className="font-medium text-sm text-gray-700">Select Template:</p>
          
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
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>
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
                  <p>No active templates found</p>
                  <p className="text-xs mt-1">Please create and activate templates first</p>
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
            onClick={onClose}
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
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
} 