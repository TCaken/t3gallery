"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { importLeads } from '~/app/_actions/leadActions';
import { 
  DocumentArrowUpIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

interface FlexibleLeadRow {
  phone_number: string;
  full_name: string;
  email?: string;
  source?: string;
  amount?: string;
  [key: string]: string | undefined;
}

interface ImportResult {
  valid: FlexibleLeadRow[];
  invalid: { row: number; errors: string[]; data: any }[];
  duplicates: { row: number; phone: string }[];
}

export default function ImportLeadsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\s+|-|\(|\)|\+65|^65/g, '');
    return /^[896]\d{7}$/.test(cleaned);
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\s+|-|\(|\)|\+65|^65/g, '');
    return cleaned;
  };

  const validateAndProcessData = (rawData: any[]): ImportResult => {
    const valid: FlexibleLeadRow[] = [];
    const invalid: { row: number; errors: string[]; data: any }[] = [];
    const duplicates: { row: number; phone: string }[] = [];
    const seenPhones = new Set<string>();

    rawData.forEach((row, index) => {
      const errors: string[] = [];
      
      // Extract and validate phone number
      let phoneNumber = '';
      if (row.phone_number) {
        phoneNumber = formatPhoneNumber(row.phone_number.toString());
        if (!validatePhoneNumber(phoneNumber)) {
          errors.push('Invalid Singapore phone number');
        }
      } else {
        errors.push('Phone number is required');
      }

      // Check for duplicates
      if (phoneNumber && seenPhones.has(phoneNumber)) {
        duplicates.push({ row: index + 1, phone: phoneNumber });
        return;
      }
      if (phoneNumber) {
        seenPhones.add(phoneNumber);
      }

      // Validate full name
      const fullName = row.full_name?.toString().trim() || row.first_name?.toString().trim() || '';
      if (!fullName) {
        errors.push('Full name is required');
      }

      if (errors.length > 0) {
        invalid.push({ row: index + 1, errors, data: row });
      } else {
        valid.push({
          phone_number: phoneNumber,
          full_name: fullName,
          email: row.email?.toString().trim() || '',
          source: row.source?.toString().trim() || 'Firebase',
          amount: row.amount?.toString().trim() || '',
        });
      }
    });

    return { valid, invalid, duplicates };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      void parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    setImportResult(null);

    try {
      let rawData: any[] = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        
        // Check if it's Firebase format (first line is a phone number)
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const isFirebaseFormat = lines.length > 0 && /^65\d{8}/.test(lines[0] || '');
        
        if (isFirebaseFormat) {
          // Process Firebase CSV format
          for (let i = 0; i < lines.length; i += 4) {
            const phoneLine = lines[i]?.trim();
            if (phoneLine && /^65\d{8}/.test(phoneLine)) {
              rawData.push({
                phone_number: phoneLine,
                full_name: `Lead ${phoneLine.substring(2)}`, // Default name
                source: 'Firebase'
              });
            }
          }
        } else {
          // Standard CSV format
          const workbook = XLSX.read(text, { type: 'string' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0] || ''];
          if (worksheet) {
            rawData = XLSX.utils.sheet_to_json(worksheet);
          }
        }
      } else {
        // Excel format
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0] || ''];
        if (worksheet) {
          rawData = XLSX.utils.sheet_to_json(worksheet);
        }
      }

      if (rawData.length === 0) {
        showNotification('No data found in the file', 'error');
        return;
      }

      const result = validateAndProcessData(rawData);
      setImportResult(result);
      
      if (result.valid.length > 0) {
        showNotification(`Found ${result.valid.length} valid leads ready to import`, 'success');
      } else {
        showNotification('No valid leads found in the file', 'error');
      }

    } catch (error) {
      console.error('Error parsing file:', error);
      showNotification('Could not parse the file. Please check the format.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const processManualInput = () => {
    if (!manualInput.trim()) {
      showNotification('Please enter some data', 'error');
      return;
    }

    setParsing(true);
    
    try {
      const lines = manualInput.split('\n').filter(line => line.trim() !== '');
      const rawData: any[] = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Try to detect if it's just a phone number or has more data
        if (/^65\d{8}$/.test(trimmed) || /^[896]\d{7}$/.test(trimmed)) {
          // Just a phone number
          rawData.push({
            phone_number: trimmed,
            full_name: `Lead ${trimmed.replace(/^65/, '')}`,
            source: 'Manual Entry'
          });
        } else {
          // Try to parse as comma-separated or tab-separated
          const parts = trimmed.split(/[,\t]/).map(p => p.trim());
          if (parts.length >= 2) {
            rawData.push({
              phone_number: parts[0],
              full_name: parts[1],
              email: parts[2] || '',
              source: 'Manual Entry'
            });
          } else {
            // Treat as just a phone number
            rawData.push({
              phone_number: parts[0] || '',
              full_name: `Lead ${(parts[0] || '').replace(/^65/, '')}`,
              source: 'Manual Entry'
            });
          }
        }
      });

      const result = validateAndProcessData(rawData);
      setImportResult(result);
      setShowManualInput(false);
      
      if (result.valid.length > 0) {
        showNotification(`Processed ${result.valid.length} valid leads from manual input`, 'success');
      } else {
        showNotification('No valid leads found in the input', 'error');
      }

    } catch (error) {
      console.error('Error processing manual input:', error);
      showNotification('Failed to process the input data', 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!importResult?.valid.length) {
      showNotification('No valid leads to import', 'error');
      return;
    }

    setImporting(true);

    try {
      // Convert to the format expected by importLeads
      const leadsData = importResult.valid.map(lead => ({
        phone_number: lead.phone_number,
        full_name: lead.full_name,
        email: lead.email || `${lead.phone_number}@imported.com`,
        source: lead.source || 'Firebase',
        status: 'new',
        lead_type: 'new',
        amount: lead.amount || ''
      }));

      const result = await importLeads(leadsData);
      
      if (result.success) {
        showNotification(`Successfully imported ${result.count} leads!`, 'success');
        setTimeout(() => {
          router.push('/dashboard/leads');
        }, 2000);
      } else {
        showNotification(`Failed to import leads: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error importing leads:', error);
      showNotification('An error occurred while importing leads', 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        phone_number: '81234567',
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        source: 'Firebase',
        amount: '5000'
      },
      {
        phone_number: '91234567', 
        full_name: 'Jane Smith',
        email: 'jane.smith@example.com',
        source: 'Firebase',
        amount: '10000'
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Firebase Leads Template');
    XLSX.writeFile(workbook, 'firebase_leads_template.xlsx');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors duration-200"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Import Leads</h1>
              <p className="text-sm text-gray-600">Import leads from Firebase CSV or manual entry</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className={`rounded-md p-3 flex items-center space-x-2 ${
            notification.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : notification.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            ) : notification.type === 'error' ? (
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
            ) : (
              <DocumentTextIcon className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Instructions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Required Fields</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Phone Number</strong> - Singapore mobile number (8 digits)</li>
                <li>• <strong>Full Name</strong> - Lead's complete name</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Optional Fields</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Email address</li>
                <li>• Lead source</li>
                <li>• Loan amount</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 flex items-center space-x-2"
            >
              <DocumentArrowUpIcon className="h-4 w-4" />
              <span>Download Template</span>
            </button>
            
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 flex items-center space-x-2"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              <span>{showManualInput ? 'Hide Manual Entry' : 'Manual Entry'}</span>
            </button>
          </div>
        </div>

        {/* Manual Input */}
        {showManualInput && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Manual Entry</h3>
            <p className="text-sm text-gray-600 mb-4">
              Paste data from Firebase or enter manually. Format: phone_number, full_name, email (one per line)
            </p>
            <div className="space-y-4">
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full h-32 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                placeholder="Examples:
6591234567, John Doe, john@example.com
6589876543, Jane Smith
6581111111"
              />
              <button
                onClick={processManualInput}
                disabled={parsing}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
              >
                {parsing ? 'Processing...' : 'Process Data'}
              </button>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">File Upload</h3>
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="flex items-center space-x-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Choose File
              </button>
              <span className="text-sm text-gray-600">
                {file ? file.name : 'No file selected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Supported formats: Excel (.xlsx, .xls) and CSV files
            </p>
          </div>
        </div>

        {/* Parsing State */}
        {parsing && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              <span className="text-sm text-gray-600">Processing data...</span>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importResult && !parsing && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="text-2xl font-semibold text-green-900">{importResult.valid.length}</div>
                  <div className="text-sm text-green-700">Valid Leads</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-2xl font-semibold text-red-900">{importResult.invalid.length}</div>
                  <div className="text-sm text-red-700">Invalid Leads</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="text-2xl font-semibold text-yellow-900">{importResult.duplicates.length}</div>
                  <div className="text-sm text-yellow-700">Duplicates</div>
                </div>
              </div>
            </div>

            {/* Valid Leads Preview */}
            {importResult.valid.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Valid Leads ({importResult.valid.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {importResult.valid.slice(0, 10).map((lead, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{lead.phone_number}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{lead.full_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{lead.email || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{lead.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.valid.length > 10 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      ... and {importResult.valid.length - 10} more leads
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Invalid Leads */}
            {importResult.invalid.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Invalid Leads ({importResult.invalid.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {importResult.invalid.map((item, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="text-sm font-medium text-red-900">Row {item.row}</div>
                      <div className="text-sm text-red-700">{item.errors.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import Button */}
            {importResult.valid.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-end">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {importing && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>{importing ? 'Importing...' : `Import ${importResult.valid.length} Leads`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
