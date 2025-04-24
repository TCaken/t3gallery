"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLead } from '~/app/_actions/leadActions';
import { leadStatusEnum, leadTypeEnum } from "~/server/db/schema";

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [formData, setFormData] = useState({
    phone_number: '', // Just the 8 digits, without +65
    first_name: '',
    last_name: '',
    email: '',
    status: 'new',
    source: '',
    lead_type: 'new'
  });
  
  const [validStatuses] = useState(['new', 'unqualified', 'give_up', 'blacklisted']);
  const [validLeadTypes] = useState(['new', 'reloan']);
  
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
    
    setLoading(true);
    
    try {
      const result = await createLead({
        ...formData,
        phone_number: fullPhoneNumber
      });
      
      if (result.success) {
        alert('Lead created successfully!');
        router.push('/dashboard/leads');
      } else {
        alert(`Failed to create lead: ${result.message}`);
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('An error occurred while creating the lead');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Add New Lead</h1>
      
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
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            disabled={loading}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {loading ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}