'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { updateBorrower } from '~/app/_actions/borrowers';
import { createBorrowerNote } from '~/app/_actions/borrowerNotes';

interface BorrowerQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrower: {
    id: number;
    full_name: string;
    phone_number: string;
    phone_number_2?: string | null;
    phone_number_3?: string | null;
    email?: string | null;
    current_employer?: string | null;
    average_monthly_income?: string | null;  // Fixed: was annual_income
    id_type: string;
    residential_status?: string | null;
    status?: string;
    source?: string | null;
    aa_status?: string | null;
    id_number?: string | null;
    credit_score?: string | null;
    loan_status?: string | null;
    lead_score?: number | null;
    latest_completed_loan_date?: string | null;
    loan_id?: string | null;
    assigned_agent_name?: string | null;
    assigned_agent_email?: string | null;
    contact_preference?: string | null;
    created_at?: Date;
    updated_at?: Date | null;
    follow_up_date?: Date | null;
    // Questionnaire fields
    employment_status_changed?: boolean;
    employment_change_details?: string;
    work_pass_expiry_status?: string;
    customer_experience_feedback?: string;
    last_questionnaire_date?: Date;
  } | null;
  onUpdate?: () => void;
}

interface QuestionnaireData {
  // Questionnaire responses only
  financing_amount: string;
  employment_status: 'same' | 'changed';
  employment_details: string; // Details if employment changed
  work_pass_expiry: 'within_3_months' | 'more_than_3_months' | 'not_applicable';
  customer_experience: string;
  notes: string;
}

const initialData: QuestionnaireData = {
  financing_amount: '',
  employment_status: 'same',
  employment_details: '',
  work_pass_expiry: 'not_applicable',
  customer_experience: '',
  notes: ''
};

export default function BorrowerQuestionnaireModal({
  isOpen,
  onClose,
  borrower,
  onUpdate
}: BorrowerQuestionnaireModalProps) {
  const [formData, setFormData] = useState<QuestionnaireData>(initialData);
  const [originalData, setOriginalData] = useState<QuestionnaireData>(initialData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Initialize form data when borrower changes
  useEffect(() => {
    if (borrower) {
      const data: QuestionnaireData = {
        financing_amount: '', // User will fill this in questionnaire
        employment_status: 'same',
        employment_details: '',
        work_pass_expiry: borrower.id_type === 'singapore_nric' ? 'not_applicable' : 'more_than_3_months',
        customer_experience: '',
        notes: ''
      };
      setFormData(data);
      setOriginalData(data);
    }
  }, [borrower]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, originalData]);

  const handleInputChange = (field: keyof QuestionnaireData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!borrower) return;

    try {
      setSaving(true);

      // 1. Update borrower fields with questionnaire responses
      const updateResult = await updateBorrower({
        id: borrower.id,
        // Do NOT update estimated_reloan_amount - leave it untouched
        employment_status_changed: formData.employment_status === 'changed',
        current_employer: formData.employment_status === 'changed' ? formData.employment_details : undefined,
        work_pass_expiry_status: formData.work_pass_expiry,
        customer_experience_feedback: formData.customer_experience,
        last_questionnaire_date: new Date()
      });

      if (!updateResult.success) {
        throw new Error('Failed to update borrower information');
      }

      // 2. Save questionnaire responses as a structured note for history
      const questionnaireNote = `
CUSTOMER QUESTIONNAIRE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Financing Amount: ${formData.financing_amount}
💼 Employment Status: ${formData.employment_status}${formData.employment_details ? ` - Current Employer: ${formData.employment_details}` : ''}
📅 Work Pass Expiry: ${formData.work_pass_expiry}
⭐ Customer Experience: ${formData.customer_experience}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();

      await createBorrowerNote({
        borrower_id: borrower.id,
        content: questionnaireNote,
        note_type: 'questionnaire'
      });

      // 3. Save additional notes if provided
      if (formData.notes.trim()) {
        await createBorrowerNote({
          borrower_id: borrower.id,
          content: formData.notes,
          note_type: 'note'
        });
      }

      // Update original data to reflect saved state
      setOriginalData(formData);
      setHasUnsavedChanges(false);
      
      // Show success message
      alert('Questionnaire saved successfully!');
      
      if (onUpdate) {
        onUpdate();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      alert('Failed to save questionnaire. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setShowUnsavedWarning(false);
    onClose();
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-SG');
  };



  const getLeadScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-500';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isOpen || !borrower) return null;

  const isForeigner = borrower.id_type !== 'singapore_nric';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold">Customer Questionnaire</h2>
            <p className="text-gray-600">{borrower.full_name} • {borrower.phone_number}</p>
          </div>
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-orange-600 text-sm flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                Unsaved changes
              </span>
            )}
            <button 
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-8">
            
            {/* Comprehensive Borrower Profile - READ ONLY */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 text-blue-800">📋 Borrower Profile</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Basic Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-300 pb-1">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {borrower.full_name}</div>
                    <div><span className="font-medium">Phone:</span> {borrower.phone_number}</div>
                    <div><span className="font-medium">Email:</span> {borrower.email ?? 'Not provided'}</div>
                    <div><span className="font-medium">Status:</span> 
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        borrower.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        borrower.status === 'done' ? 'bg-green-100 text-green-800' :
                        borrower.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {borrower.status ?? 'Unknown'}
                      </span>
                    </div>
                    <div><span className="font-medium">Source:</span> {borrower.source || 'Not specified'}</div>
                    <div><span className="font-medium">Assigned To:</span> {borrower.assigned_agent_name || 'Unassigned'}</div>
                  </div>
                </div>

                {/* Identity & Financial */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-300 pb-1">Identity & Financial</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">ID Type:</span> {borrower.id_type}</div>
                    <div><span className="font-medium">ID Number:</span> {borrower.id_number ?? 'Not provided'}</div>
                    <div><span className="font-medium">AA Status:</span> 
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        borrower.aa_status === 'yes' ? 'bg-green-100 text-green-800' :
                        borrower.aa_status === 'no' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {borrower.aa_status ?? 'Pending'}
                      </span>
                    </div>
                    <div><span className="font-medium">Residential Status:</span> {borrower.residential_status ?? 'Not specified'}</div>
                    <div><span className="font-medium">Current Employer:</span> {borrower.current_employer ?? 'Not provided'}</div>
                    <div><span className="font-medium">Monthly Income:</span> {borrower.average_monthly_income ?? 'Not provided'}</div>
                    <div><span className="font-medium">Contact Preference:</span> {borrower.contact_preference ?? 'No Preferences'}</div>
                  </div>
                </div>

                {/* Loan Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-300 pb-1">Loan Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Loan ID:</span> {borrower.loan_id ?? 'Not assigned'}</div>
                    <div><span className="font-medium">Loan Status:</span> {borrower.loan_status ?? 'Not specified'}</div>
                    <div><span className="font-medium">Credit Score:</span> {borrower.credit_score ?? 'Not available'}</div>
                    <div><span className="font-medium">Lead Score:</span> 
                      <span className={`ml-1 font-semibold ${getLeadScoreColor(borrower.lead_score)}`}>
                        {borrower.lead_score ?? 0}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Important Dates */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-300 pb-1">Important Dates</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Created:</span> {formatDate(borrower.created_at)}</div>
                    <div><span className="font-medium">Updated:</span> {formatDate(borrower.updated_at)}</div>
                    <div><span className="font-medium">Last Loan:</span> {formatDate(borrower.latest_completed_loan_date)}</div>
                    <div><span className="font-medium">Follow-up:</span> {formatDate(borrower.follow_up_date)}</div>
                  </div>
                </div>



                {/* Questionnaire History */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-300 pb-1">Questionnaire History</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Last Updated:</span> {formatDate(borrower.last_questionnaire_date)}</div>
                    <div><span className="font-medium">Employment Changed:</span> 
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        borrower.employment_status_changed ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {borrower.employment_status_changed ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {borrower.employment_change_details && (
                      <div><span className="font-medium">Details:</span> {borrower.employment_change_details}</div>
                    )}
                    {isForeigner && (
                      <div><span className="font-medium">Work Pass:</span> 
                        <span className={`ml-1 px-2 py-1 rounded text-xs ${
                          borrower.work_pass_expiry_status === 'within_3_months' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {borrower.work_pass_expiry_status?.replace(/_/g, ' ') || 'Not specified'}
                        </span>
                      </div>
                    )}
                    {borrower.customer_experience_feedback && (
                      <div className="bg-blue-50 p-2 rounded">
                        <span className="font-medium">Customer Experience:</span>
                        <p className="text-xs mt-1 italic">"{borrower.customer_experience_feedback}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Questionnaire Section */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">📝 Customer Questionnaire</h3>
              
              {/* Question 1 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. How much financing are you looking for right now? *
                </label>
                <input
                  type="text"
                  value={formData.financing_amount}
                  onChange={(e) => handleInputChange('financing_amount', e.target.value)}
                  className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter financing amount (e.g., $50,000)"
                />
              </div>

              {/* Question 2 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. Are you still working at the same company as during your previous loan? *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="employment_status"
                      value="same"
                      checked={formData.employment_status === 'same'}
                      onChange={(e) => handleInputChange('employment_status', e.target.value)}
                      className="mr-2"
                    />
                    Yes, same company
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="employment_status"
                      value="changed"
                      checked={formData.employment_status === 'changed'}
                      onChange={(e) => handleInputChange('employment_status', e.target.value)}
                      className="mr-2"
                    />
                    No, employment has changed
                  </label>
                  {formData.employment_status === 'changed' && (
                    <div className="ml-6 mt-2">
                      <input
                        type="text"
                        value={formData.employment_details}
                        onChange={(e) => handleInputChange('employment_details', e.target.value)}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter current employer name"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Question 3 - Only for foreigners */}
              {isForeigner && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3. When does your work pass expire? (If Foreigner)
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="work_pass_expiry"
                        value="within_3_months"
                        checked={formData.work_pass_expiry === 'within_3_months'}
                        onChange={(e) => handleInputChange('work_pass_expiry', e.target.value)}
                        className="mr-2"
                      />
                      Within 3 Months
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="work_pass_expiry"
                        value="more_than_3_months"
                        checked={formData.work_pass_expiry === 'more_than_3_months'}
                        onChange={(e) => handleInputChange('work_pass_expiry', e.target.value)}
                        className="mr-2"
                      />
                      More Than 3 Months
                    </label>
                  </div>
                </div>
              )}

              {/* Question 4 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isForeigner ? '4' : '3'}. Customer's experience with Crawfort *
                </label>
                <textarea
                  value={formData.customer_experience}
                  onChange={(e) => handleInputChange('customer_experience', e.target.value)}
                  className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="Please share the customer's experience and feedback about Crawfort..."
                />
              </div>

              {/* Additional Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="Add any additional notes or observations about this borrower..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center text-sm text-gray-600">
            {hasUnsavedChanges && (
              <span className="flex items-center text-orange-600">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                You have unsaved changes
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Save Questionnaire</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Unsaved Changes Warning Modal */}
        {showUnsavedWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium mb-4">Unsaved Changes</h3>
              <p className="text-gray-600 mb-6">
                You have unsaved changes. Are you sure you want to close without saving?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClose}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Close Without Saving
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 