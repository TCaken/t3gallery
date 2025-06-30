"use client";

import { useState } from "react";
import { updateBorrower } from "~/app/_actions/borrowers";
import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  LanguageIcon,
  ClockIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";

interface BorrowerCommunicationPreferencesProps {
  borrowerId: number;
  currentContactPreference?: string;
  currentCommunicationLanguage?: string;
  onSuccess?: () => void;
}

export default function BorrowerCommunicationPreferences({
  borrowerId,
  currentContactPreference = "No Preferences",
  currentCommunicationLanguage = "No Preferences",
  onSuccess
}: BorrowerCommunicationPreferencesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactPreference, setContactPreference] = useState(currentContactPreference);
  const [communicationLanguage, setCommunicationLanguage] = useState(currentCommunicationLanguage);

  const contactOptions = [
    { id: "phone", label: "Phone Call", icon: PhoneIcon, description: "Prefer phone calls" },
    { id: "whatsapp", label: "WhatsApp", icon: ChatBubbleLeftRightIcon, description: "Prefer WhatsApp messages" },
    { id: "email", label: "Email", icon: EnvelopeIcon, description: "Prefer email communication" },
    { id: "morning", label: "Morning (9AM-12PM)", icon: ClockIcon, description: "Best time: Morning" },
    { id: "afternoon", label: "Afternoon (12PM-6PM)", icon: ClockIcon, description: "Best time: Afternoon" },
    { id: "evening", label: "Evening (6PM-9PM)", icon: ClockIcon, description: "Best time: Evening" },
    { id: "no_preferences", label: "No Preferences", icon: CheckCircleIcon, description: "Any contact method" }
  ];

  const languageOptions = [
    { id: "english", label: "English", flag: "🇬🇧" },
    { id: "mandarin", label: "Mandarin", flag: "🇨🇳" },
    { id: "malay", label: "Malay", flag: "🇲🇾" },
    { id: "tamil", label: "Tamil", flag: "🇮🇳" },
    { id: "hokkien", label: "Hokkien", flag: "🇸🇬" },
    { id: "cantonese", label: "Cantonese", flag: "🇭🇰" },
    { id: "no_preferences", label: "No Preferences", flag: "🌐" }
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateBorrower({
        id: borrowerId,
        contact_preference: contactPreference,
        communication_language: communicationLanguage
      });

      if (result.success) {
        onSuccess?.();
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error updating communication preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = 
    contactPreference !== currentContactPreference || 
    communicationLanguage !== currentCommunicationLanguage;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Communication Preferences</h3>
          <button
            onClick={() => setIsOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            📝 Update
          </button>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Contact Method:</span>
            <span className="font-medium capitalize">
              {currentContactPreference?.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <LanguageIcon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Language:</span>
            <span className="font-medium capitalize">
              {currentCommunicationLanguage?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Communication Preferences</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Contact Preference */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">How would you like to be contacted?</h3>
                <div className="grid grid-cols-1 gap-3">
                  {contactOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`
                        flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all
                        ${contactPreference === option.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="contactPreference"
                        value={option.id}
                        checked={contactPreference === option.id}
                        onChange={(e) => setContactPreference(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <option.icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-600">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Language Preference */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">What language do you prefer?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {languageOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`
                        flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all
                        ${communicationLanguage === option.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="communicationLanguage"
                        value={option.id}
                        checked={communicationLanguage === option.id}
                        onChange={(e) => setCommunicationLanguage(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-2xl">{option.flag}</span>
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || loading}
                  className={`
                    px-4 py-2 rounded-lg text-white font-medium transition-colors
                    ${(!hasChanges || loading)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                  `}
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 