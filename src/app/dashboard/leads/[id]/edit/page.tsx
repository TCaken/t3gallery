"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchLeadById, updateLead } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

type Lead = InferSelectModel<typeof leads>;

export default function EditLeadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const leadId = parseInt(params.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  
  const [formData, setFormData] = useState({
    phone_number: '',
    first_name: '',
    last_name: '',
    email: '',
    nationality: '',
    employment_status: '',
    loan_purpose: '',
    existing_loans: '',
    amount: '',
    status: 'new',
    source: '',
    lead_type: 'new'
  });
  
  const validStatuses = [
    'new',
    'open',
    'contacted',
    'no_answer',
    'follow_up',
    'booked',
    'unqualified',
    'give_up',
    'blacklisted'
  ];
  const validLeadTypes = ['new', 'reloan'];
  
  useEffect(() => {
    const loadLead = async () => {
      try {
        setLoading(true);
        const result = await fetchLeadById(leadId);
        if (result.success) {
          if (!result.lead) {
            throw new Error('Lead not found');
          }

          const phoneNumber = result.lead.phone_number?.replace(/^\+65/, '') ?? '';
          
          setFormData({
            phone_number: phoneNumber,
            first_name: result.lead.first_name ?? '',
            last_name: result.lead.last_name ?? '',
            email: result.lead.email ?? '',
            nationality: result.lead.nationality ?? '',
            employment_status: result.lead.employment_status ?? '',
            loan_purpose: result.lead.loan_purpose ?? '',
            existing_loans: result.lead.existing_loans ?? '',
            amount: result.lead.amount ?? '',
            status: result.lead.status ?? 'new',
            source: result.lead.source ?? '',
            lead_type: result.lead.lead_type ?? 'new'
          });
        } else {
          setError(result.message || "Failed to load lead");
        }
      } catch (err) {
        console.error("Error loading lead:", err);
        setError("An error occurred while loading the lead");
      } finally {
        setLoading(false);
      }
    };

    void loadLead();
  }, [leadId]);
  
  // Singapore phone number validation (just the 8 digits)
  const validateSGPhoneNumber = (phone: string) => {
    // Check if it's 8 digits and starts with 8 or 9 (mobile) or 6 (landline)
    return /^[896]\d{7}$/.test(phone);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Special handling for phone number
    if (name === 'phone_number') {
      setPhoneError('');
      
      // Only allow digits for phone number
      const digitsOnly = value.replace(/\D/g, '');
      
      // Limit to 8 digits
      const truncated = digitsOnly.slice(0, 8);
      
      setFormData(prev => ({ ...prev, [name]: truncated }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (!validateSGPhoneNumber(formData.phone_number)) {
      setPhoneError('Please enter a valid Singapore phone number (8 digits starting with 8, 9, or 6)');
      return;
    }
    
    // Add +65 prefix to the phone number
    const fullPhoneNumber = `+65${formData.phone_number}`;
    
    setSaving(true);
    
    try {
      const result = await updateLead(leadId, {
        ...formData,
        phone_number: fullPhoneNumber
      });
      
      if (result.success) {
        alert('Lead updated successfully!');
        router.push(`/dashboard/leads/${leadId}`);
      } else {
        alert(`Failed to update lead: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('An error occurred while updating the lead');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push("/dashboard/leads")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.push(`/dashboard/leads/${leadId}`)}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Edit Lead</h1>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                Phone Number <span className="text-red-500">*</span>
              </label>
              
              {/* Custom phone input with +65 prefix */}
              <div className={`mt-1 flex rounded-md shadow-sm border ${phoneError ? 'border-red-500' : 'border-gray-300'}`}>
                <span className="inline-flex items-center px-3 rounded-l-md border-r border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  +65
                </span>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  required
                  placeholder="81234567"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              {phoneError ? (
                <p className="mt-1 text-xs text-red-500">{phoneError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Enter 8 digits only (e.g., 81234567)
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="nationality" className="block text-sm font-medium text-gray-700">
                Nationality
              </label>
              <input
                type="text"
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount
              </label>
              <input
                type="text"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="employment_status" className="block text-sm font-medium text-gray-700">
                Employment Status
              </label>
              <input
                type="text"
                id="employment_status"
                name="employment_status"
                value={formData.employment_status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="loan_purpose" className="block text-sm font-medium text-gray-700">
                Loan Purpose
              </label>
              <input
                type="text"
                id="loan_purpose"
                name="loan_purpose"
                value={formData.loan_purpose}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="existing_loans" className="block text-sm font-medium text-gray-700">
                Existing Loans
              </label>
              <input
                type="text"
                id="existing_loans"
                name="existing_loans"
                value={formData.existing_loans}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700">
                Source
              </label>
              <input
                type="text"
                id="source"
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {validStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="lead_type" className="block text-sm font-medium text-gray-700">
                Lead Type
              </label>
              <select
                id="lead_type"
                name="lead_type"
                value={formData.lead_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {validLeadTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 