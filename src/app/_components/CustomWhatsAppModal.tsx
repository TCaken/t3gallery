'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface WhatsAppTemplate {
  id: string;
  name: string;
  description: string;
  supportedMethods: ('sms' | 'whatsapp' | 'both')[];
}

type DeliveryMethod = 'sms' | 'whatsapp' | 'both';

interface CustomWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (templateId: string, parameters: Record<string, string>, deliveryMethod?: 'sms' | 'whatsapp' | 'both') => Promise<void>;
  phoneNumber: string;
}

const templates: WhatsAppTemplate[] = [
  {
    id: 'example_template',
    name: 'Example Template',
    description: 'Current active template',
    supportedMethods: ['whatsapp']
  },
  {
    id: 'booked_appointment',
    name: 'Booked Appointment',
    description: 'Send appointment confirmation to customer',
    supportedMethods: ['sms', 'whatsapp', 'both']
  },
  {
    id: 'rejected_appointment',
    name: 'Rejected Appointment',
    description: 'Notify customer about rejected appointment',
    supportedMethods: ['sms', 'whatsapp', 'both']
  },
  {
    id: 'no_answer',
    name: 'No Answer',
    description: 'Follow up when customer does not answer',
    supportedMethods: ['sms', 'whatsapp', 'both']
  },
  {
    id: 'missed_appointment',
    name: 'Missed Appointment',
    description: 'Notify customer they missed an appointment',
    supportedMethods: ['whatsapp']
  },
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    description: 'Remind customer about upcoming appointment',
    supportedMethods: ['sms', 'whatsapp', 'both']
  }
];

export default function CustomWhatsAppModal({
  isOpen,
  onClose,
  onSend,
  phoneNumber
}: CustomWhatsAppModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('whatsapp');
  
  if (!isOpen) return null;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    // Find the template and set default delivery method
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Default to WhatsApp if supported, otherwise first available method
      if (template.supportedMethods.includes('whatsapp')) {
        setDeliveryMethod('whatsapp');
      } else if (template.supportedMethods.length > 0) {
        // Ensure we're not passing undefined
        const firstMethod = template.supportedMethods[0];
        if (firstMethod) {
          setDeliveryMethod(firstMethod);
        }
      }
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    
    // Get the selected template to determine supported methods
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;
    
    // Only use the delivery method if it's supported by the template
    if (template.supportedMethods.includes(deliveryMethod)) {
      await onSend(selectedTemplate, {}, deliveryMethod);
    } else if (template.supportedMethods.length > 0) {
      // Fallback to first supported method
      await onSend(selectedTemplate, {}, template.supportedMethods[0]);
    } else {
      // This should never happen as we check for supported methods when selecting template
      await onSend(selectedTemplate, {});
    }
    onClose();
  };

  const getMethodLabel = (method: DeliveryMethod): string => {
    switch (method) {
      case 'sms': return 'SMS';
      case 'whatsapp': return 'WhatsApp';
      case 'both': return 'SMS & WhatsApp';
      default: return '';
    }
  };

  const isDisabled = (templateId: string): boolean => {
    return templateId !== 'example_template';
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
          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => !isDisabled(template.id) && handleTemplateSelect(template.id)}
                className={`p-4 ${
                  selectedTemplate === template.id 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-50'
                } ${
                  isDisabled(template.id) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                } transition-colors`}
              >
                <div className="flex justify-between">
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  {template.id === 'example_template' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  {template.supportedMethods.map(method => (
                    <span 
                      key={method} 
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                    >
                      {getMethodLabel(method)}
                    </span>
                  ))}
                </div>
                {isDisabled(template.id) && (
                  <p className="text-xs text-red-500 mt-1">Currently unavailable</p>
                )}
              </div>
            ))}
          </div>
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
                disabled={isDisabled(selectedTemplate)}
              >
                {templates
                  .find(t => t.id === selectedTemplate)
                  ?.supportedMethods.map(method => (
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
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={!selectedTemplate}
            className={`px-4 py-2 text-white rounded-md ${
              selectedTemplate 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-blue-300 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
} 