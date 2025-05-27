"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { importLeads } from '~/app/_actions/leadActions';

interface LeadImportRow {
  phone_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  source: string;
  lead_type: string;
  [key: string]: string; // For any additional columns
}

export default function ImportLeadsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<LeadImportRow[]>([]);
  const [errorRows, setErrorRows] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [validStatuses] = useState(['new', 'unqualified', 'give_up', 'blacklisted']);
  const [validLeadTypes] = useState(['new', 'reloan']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'standard' | 'firebase'>('standard');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPhoneNumbers, setManualPhoneNumbers] = useState('');
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      void parseFile(selectedFile);
    }
  };

  const validateSGPhoneNumber = (phone: string) => {
    if (!phone) return false;
    
    // Remove spaces, dashes, and +65 prefix
    const cleaned = phone.replace(/\s+|-|\(|\)|\+65|^65/g, '');
    
    // Check if it's 8 digits and starts with 8 or 9 (mobile) or 6 (landline)
    return /^[896]\d{7}$/.test(cleaned);
  };
  
  const parseFile = async (file: File) => {
    setParsing(true);
    
    try {
      // Determine file type
      if (file.name.toLowerCase().endsWith('.csv')) {
        await parseCSV(file);
      } else {
        await parseExcel(file);
      }
    } catch (err) {
      console.error('Error parsing file:', err);
      alert('Could not parse the file. Please make sure it is a valid format.');
    } finally {
      setParsing(false);
    }
  };

  const parseCSV = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      // Detect Firebase format (check first line for phone number)
      const isFirebaseFormat = lines.length > 0 && lines[0] && /^65\d{8}/.test(lines[0]);
      
      if (isFirebaseFormat) {
        setImportMode('firebase');
        // Process Firebase format
        const firebaseLeads: LeadImportRow[] = [];
        
        for (let i = 0; i < lines.length; i += 4) {
          if (i >= lines.length) break;
          
          const phoneRow = lines[i]?.trim() ?? '';
          // We'll skip the dates since they're not useful as mentioned
          
          if (phoneRow.match(/^65\d{8}/)) {
            const phoneNumber = phoneRow.replace(/^65/, ''); // Remove 65 prefix
            
            firebaseLeads.push({
              phone_number: phoneNumber,
              first_name: 'AirConnect',
              last_name: phoneNumber,
              email: `airconnect${phoneNumber}@test.com`,
              status: 'new',
              source: 'Firebase Import',
              lead_type: 'new'
            });
          }
        }
        
        // Validate phone numbers
        const errors: number[] = [];
        firebaseLeads.forEach((lead, index) => {
          if (!validateSGPhoneNumber(lead.phone_number)) {
            errors.push(index);
          }
        });
        
        setErrorRows(errors);
        setParsedData(firebaseLeads);
        return;
      } else {
        // Standard CSV format - use XLSX to parse
        const workbook = XLSX.read(text, { type: 'string' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0] || ''];
        if (!worksheet) {
          throw new Error('No worksheet found in CSV');
        }
        const jsonData = XLSX.utils.sheet_to_json<LeadImportRow>(worksheet);
        
        // Validate data
        const errors: number[] = [];
        jsonData.forEach((row, index) => {
          if (!row.phone_number || !validateSGPhoneNumber(row.phone_number)) {
            errors.push(index);
          }
          
          if (row.status && !validStatuses.includes(row.status.toLowerCase())) {
            errors.push(index);
          }
          
          if (row.lead_type && !validLeadTypes.includes(row.lead_type.toLowerCase())) {
            errors.push(index);
          }
        });
        
        setErrorRows(errors);
        setParsedData(jsonData);
        setImportMode('standard');
      }
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      throw error;
    }
  };
  
  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0] || ''];
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }
      const jsonData = XLSX.utils.sheet_to_json<LeadImportRow>(worksheet);
      
      // Validate data
      const errors: number[] = [];
      jsonData.forEach((row, index) => {
        if (!row.phone_number || !validateSGPhoneNumber(row.phone_number)) {
          errors.push(index);
        }
        
        if (row.status && !validStatuses.includes(row.status.toLowerCase())) {
          errors.push(index);
        }
        
        if (row.lead_type && !validLeadTypes.includes(row.lead_type.toLowerCase())) {
          errors.push(index);
        }
      });
      
      setErrorRows(errors);
      setParsedData(jsonData);
      setImportMode('standard');
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw error;
    }
  };
  
  const handleImport = async () => {
    if (errorRows.length > 0) {
      const proceed = confirm('There are errors in some rows. Do you want to import only the valid rows?');
      if (!proceed) return;
    }
    
    setImporting(true);
    
    try {
      // Filter out rows with errors
      const validData = parsedData.filter((_, index) => !errorRows.includes(index));
      
      const result = await importLeads(validData);
      
      if (result.success) {
        alert(`Successfully imported ${result.count} leads!`);
        router.push('/dashboard/leads');
      } else {
        alert(`Failed to import leads: ${result.message}`);
      }
    } catch (error) {
      console.error('Error importing leads:', error);
      alert('An error occurred while importing leads');
    } finally {
      setImporting(false);
    }
  };
  
  const downloadTemplate = () => {
    const template = [
      {
        phone_number: '81234567', // Just the 8 digits without +65
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        status: 'new',
        source: 'Website',
        lead_type: 'new'
      },
      {
        phone_number: '91234567', // Just the 8 digits without +65
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        status: 'unqualified',
        source: 'Referral',
        lead_type: 'reloan'
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Template');
    XLSX.writeFile(workbook, 'leads_import_template.xlsx');
  };

  const useFirebaseTemplate = () => {
    // This will load the Firebase template from public/templates folder
    fetch('/templates/CopyPasteFromFirebase - Sheet1.csv')
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'firebase-template.csv', { type: 'text/csv' });
        setFile(file);
        void parseFile(file);
      })
      .catch(error => {
        console.error('Error loading Firebase template:', error);
        alert('Failed to load Firebase template');
      });
  };

  const processManualPhoneNumbers = () => {
    if (!manualPhoneNumbers.trim()) {
      alert('Please enter some phone numbers');
      return;
    }

    setParsing(true);
    try {
      // Split by any whitespace or commas
      const phoneLines = manualPhoneNumbers
        .split(/[\s,]+/)
        .filter(line => line.trim() !== '');
      
      const firebaseLeads: LeadImportRow[] = [];
      
      phoneLines.forEach(line => {
        // Remove any non-digit characters and handle 65 prefix
        const cleanedLine = line.replace(/\D/g, '');
        let phoneNumber = cleanedLine;
        
        // Remove 65 prefix if present
        if (phoneNumber.startsWith('65') && phoneNumber.length > 8) {
          phoneNumber = phoneNumber.substring(2);
        }
        
        if (phoneNumber && phoneNumber.length === 8) {
          firebaseLeads.push({
            phone_number: phoneNumber,
            first_name: 'AirConnect',
            last_name: phoneNumber,
            email: `airconnect${phoneNumber}@test.com`,
            status: 'new',
            source: 'Firebase Manual Import',
            lead_type: 'new'
          });
        }
      });
      
      // Validate phone numbers
      const errors: number[] = [];
      firebaseLeads.forEach((lead, index) => {
        if (!validateSGPhoneNumber(lead.phone_number)) {
          errors.push(index);
        }
      });
      
      setErrorRows(errors);
      setParsedData(firebaseLeads);
      setImportMode('firebase');
      
      // Hide the manual input now that we've processed it
      setShowManualInput(false);
    } catch (error) {
      console.error('Error processing manual phone numbers:', error);
      alert('Failed to process phone numbers');
    } finally {
      setParsing(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Import Leads from Excel or CSV</h1>
      
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Choose an import method:
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Standard: Download and use our template Excel file</li>
              <li>Firebase: Use the Firebase CSV format with phone numbers</li>
            </ul>
          </li>
          <li>For standard imports, fill in your lead data following the template format</li>
          <li>For phone numbers, you can either include +65 or just enter the 8 digits</li>
          <li>Upload your file or use the Firebase template directly</li>
          <li>Review the data before importing</li>
          <li>Click Import to add the leads to your database</li>
        </ol>
        
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Download Template
          </button>
          
          <button
            onClick={useFirebaseTemplate}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Use Firebase Template
          </button>
          
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            {showManualInput ? 'Hide Manual Input' : 'Enter Phone Numbers Manually'}
          </button>
        </div>
        
        {showManualInput && (
          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold mb-2">Manual Phone Number Entry</h3>
            <p className="text-xs text-gray-600 mb-2">
              Paste phone numbers from Firebase or any source. 
              Numbers can be separated by spaces, commas, or line breaks.
              The system will automatically format and import them.
            </p>
            <textarea
              value={manualPhoneNumbers}
              onChange={(e) => setManualPhoneNumbers(e.target.value)}
              className="w-full h-32 border border-gray-300 rounded-md p-2 mb-3 font-mono text-sm"
              placeholder="Example:
6590123456
6581234567
65 9876 5432
65-9876-5432"
            />
            <button
              onClick={processManualPhoneNumbers}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Process Phone Numbers
            </button>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-2">Upload File</h2>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />
        <div className="flex items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Choose File
          </button>
          <span className="ml-3 text-gray-600">
            {file ? file.name : 'No file selected'}
          </span>
          {importMode === 'firebase' && (
            <span className="ml-3 text-blue-600 text-sm font-medium">
              (Firebase Format Detected)
            </span>
          )}
        </div>
      </div>
      
      {parsing && (
        <div className="text-center py-4">
          <p className="text-gray-600">Parsing file...</p>
        </div>
      )}
      
      {parsedData.length > 0 && !parsing && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-2">
            Preview Data
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({parsedData.length} rows, {errorRows.length} with errors)
            </span>
          </h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Row
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedData.slice(0, 10).map((row, index) => (
                  <tr 
                    key={index} 
                    className={errorRows.includes(index) ? 'bg-red-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                      {errorRows.includes(index) && (
                        <span className="ml-2 text-red-600">⚠️</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {validateSGPhoneNumber(row.phone_number) 
                        ? <span>+65 {row.phone_number.replace(/^\+65|^65/, '')}</span>
                        : <span className="text-red-500">Invalid number</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.first_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.last_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {validStatuses.includes(row.status?.toLowerCase() || '') 
                        ? row.status 
                        : <span className="text-red-500">{row.status || importMode === 'firebase' ? 'new' : 'Invalid'}</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.source || (importMode === 'firebase' ? 'Firebase Import' : '-')}
                    </td>
                  </tr>
                ))}
                {parsedData.length > 10 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      And {parsedData.length - 10} more rows...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsedData.length === 0}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {importing ? 'Importing...' : 'Import Leads'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
