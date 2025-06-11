"use client";

import { useState } from 'react';
import { 
  ClockIcon, 
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlayIcon,
  UsersIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { triggerTodayAppointmentWebhooks } from '~/app/_actions/appointmentWebhookTrigger';
import { importCSVLeads } from '~/app/_actions/csvImportActions';

interface WebhookResult {
  success: boolean;
  message: string;
  processedCount: number;
  successCount?: number;
  errorCount?: number;
  currentDate?: string;
  singaporeTime?: string;
  appointments?: Array<{
    appointmentId: number;
    leadName: string | null;
    leadPhone: string | null;
    startTime: string;
    status: 'success' | 'error';
    message: string;
  }>;
  error?: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  summary: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  errors: string[];
  successfulLeads?: Array<{
    name: string;
    phone: string;
    source: string;
    status: string;
  }>;
  skippedLeads?: Array<{
    name: string;
    phone: string;
    reason: string;
  }>;
  failedLeads?: Array<{
    name: string;
    phone: string;
    reason: string;
  }>;
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<WebhookResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleTriggerWebhooks = async () => {
    setIsLoading(true);
    setWebhookResult(null);

    try {
      console.log('🚀 Triggering today\'s appointment webhooks...');
      const result = await triggerTodayAppointmentWebhooks();
      console.log('📊 Webhook trigger result:', result);
      
      setWebhookResult(result as WebhookResult);
    } catch (error) {
      console.error('❌ Error triggering webhooks:', error);
      setWebhookResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        processedCount: 0,
        error: 'Failed to trigger webhooks'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVImport = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      // Read the CSV file from public/templates
      const response = await fetch('/templates/FOLLOW UP MIGRATION AIRCONNECT - FOLLOW UP MIGRATION.csv');
      if (!response.ok) {
        throw new Error('Failed to load CSV file');
      }
      
      const csvContent = await response.text();
      const result = await importCSVLeads(csvContent);
      
      setImportResult(result);
    } catch (error) {
      console.error('❌ Error importing CSV:', error);
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        summary: { total: 0, successful: 0, skipped: 0, failed: 0 },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getCurrentSingaporeTime = () => {
    const now = new Date();
    const singaporeTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return {
      date: singaporeTime.toISOString().split('T')[0],
      time: singaporeTime.toTimeString().split(' ')[0],
      fullDateTime: singaporeTime.toISOString()
    };
  };

  const { date: currentDate, time: currentTime } = getCurrentSingaporeTime();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage system settings and manual operations</p>
      </div>

      {/* Current Time Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-8 border border-blue-200">
        <div className="flex items-center mb-4">
          <ClockIcon className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-blue-900">Current System Time</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-blue-700 font-medium">Singapore Date (UTC+8)</p>
            <p className="text-blue-900 font-mono text-lg">{currentDate}</p>
          </div>
          <div>
            <p className="text-blue-700 font-medium">Singapore Time (UTC+8)</p>
            <p className="text-blue-900 font-mono text-lg">{currentTime}</p>
          </div>
          <div>
            <p className="text-blue-700 font-medium">Timezone</p>
            <p className="text-blue-900 font-mono text-lg">Asia/Singapore</p>
          </div>
        </div>
      </div>

      {/* CSV Import Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-6">
          <DocumentArrowUpIcon className="h-6 w-6 text-gray-600 mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">CSV Lead Import</h2>
            <p className="text-gray-600 text-sm mt-1">
              Import leads from the follow-up migration CSV file with notes and assignments
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <DocumentTextIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-green-800 font-medium mb-1">What this imports:</p>
              <ul className="text-green-700 space-y-1 ml-2">
                <li>• Reads: /templates/FOLLOW UP MIGRATION AIRCONNECT - FOLLOW UP MIGRATION.csv</li>
                <li>• Assigns all leads to: user_2y2V1dGLmNQZ6JqpNqLz8YKQN2k</li>
                <li>• Sets status to: follow_up for immediate attention</li>
                <li>• Includes individual notes for each lead</li>
                <li>• Validates Singapore phone numbers and skips duplicates</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Import Follow-Up Migration Data</h3>
            <p className="text-sm text-gray-600">Process CSV file and create leads with notes</p>
          </div>
          <button
            onClick={handleCSVImport}
            disabled={isImporting}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              isImporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            }`}
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Importing...
              </>
            ) : (
              <>
                <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                Import CSV Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* CSV Import Results */}
      {importResult && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-4">
            {importResult.success ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
            ) : (
              <XMarkIcon className="h-6 w-6 text-red-600 mr-3" />
            )}
            <h3 className="text-lg font-semibold">CSV Import Results</h3>
          </div>

          <div className={`rounded-lg p-4 mb-6 ${
            importResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              importResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {importResult.message}
            </p>
            
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-700">Total Processed</p>
                <p className="font-bold text-lg">{importResult.summary.total}</p>
              </div>
              <div>
                <p className="text-green-700">Successful</p>
                <p className="text-green-900 font-bold text-lg">{importResult.summary.successful}</p>
              </div>
              <div>
                <p className="text-yellow-700">Skipped</p>
                <p className="text-yellow-900 font-bold text-lg">{importResult.summary.skipped}</p>
              </div>
              <div>
                <p className="text-red-700">Failed</p>
                <p className="text-red-900 font-bold text-lg">{importResult.summary.failed}</p>
              </div>
            </div>
          </div>

          {/* Detailed Lead Information */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Successful Leads */}
            {importResult.successfulLeads && importResult.successfulLeads.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-3 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Successfully Imported ({importResult.successfulLeads.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.successfulLeads.slice(0, 10).map((lead, index) => (
                    <div key={index} className="bg-white p-3 rounded border border-green-200">
                      <p className="font-medium text-green-900 text-sm">{lead.name}</p>
                      <p className="text-green-700 text-xs">{lead.phone}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          {lead.source}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {lead.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {importResult.successfulLeads.length > 10 && (
                    <p className="text-sm text-green-600 italic text-center">
                      ... and {importResult.successfulLeads.length - 10} more successful leads
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Skipped Leads */}
            {importResult.skippedLeads && importResult.skippedLeads.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-3 flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Skipped Leads ({importResult.skippedLeads.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.skippedLeads.slice(0, 10).map((lead, index) => (
                    <div key={index} className="bg-white p-3 rounded border border-yellow-200">
                      <p className="font-medium text-yellow-900 text-sm">{lead.name}</p>
                      <p className="text-yellow-700 text-xs">{lead.phone}</p>
                      <p className="text-xs text-yellow-600 mt-1">{lead.reason}</p>
                    </div>
                  ))}
                  {importResult.skippedLeads.length > 10 && (
                    <p className="text-sm text-yellow-600 italic text-center">
                      ... and {importResult.skippedLeads.length - 10} more skipped leads
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Failed Leads */}
            {importResult.failedLeads && importResult.failedLeads.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-3 flex items-center">
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Failed Leads ({importResult.failedLeads.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.failedLeads.slice(0, 10).map((lead, index) => (
                    <div key={index} className="bg-white p-3 rounded border border-red-200">
                      <p className="font-medium text-red-900 text-sm">{lead.name}</p>
                      <p className="text-red-700 text-xs">{lead.phone}</p>
                      <p className="text-xs text-red-600 mt-1">{lead.reason}</p>
                    </div>
                  ))}
                  {importResult.failedLeads.length > 10 && (
                    <p className="text-sm text-red-600 italic text-center">
                      ... and {importResult.failedLeads.length - 10} more failed leads
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* General Error Messages */}
          {importResult.errors.length > 0 && (
            <div>
              <h4 className="font-medium text-red-800 mb-2">
                General Issues ({importResult.errors.length}):</h4>
              <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {importResult.errors.slice(0, 10).map((error, index) => (
                  <p key={index} className="text-sm text-red-700 mb-1">{error}</p>
                ))}
                {importResult.errors.length > 10 && (
                  <p className="text-sm text-red-600 italic">
                    ... and {importResult.errors.length - 10} more issues
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appointment Webhook Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-6">
          <ServerStackIcon className="h-6 w-6 text-gray-600 mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Appointment Webhook Trigger</h2>
            <p className="text-gray-600 text-sm mt-1">
              Manually send webhooks for all appointments scheduled for today (Singapore time)
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-amber-800 font-medium mb-1">How this works:</p>
              <ul className="text-amber-700 space-y-1 ml-2">
                <li>• Searches for appointments scheduled for today ({currentDate}) in Singapore timezone</li>
                <li>• Compares appointment start dates with current date in UTC+8</li>
                <li>• Sends webhook data for each matching appointment</li>
                <li>• Shows detailed results including success/failure status</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Trigger Today's Appointment Webhooks</h3>
            <p className="text-sm text-gray-600">Send webhooks for appointments on {currentDate}</p>
          </div>
          <button
            onClick={handleTriggerWebhooks}
            disabled={isLoading}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <PlayIcon className="h-5 w-5 mr-2" />
                Trigger Webhooks
              </>
            )}
          </button>
        </div>
      </div>

      {/* Follow-Up Migration Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-6">
          <UsersIcon className="h-6 w-6 text-gray-600 mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Follow-Up Migration</h2>
            <p className="text-gray-600 text-sm mt-1">
              Migrate leads assigned to specific users to follow-up status for immediate attention
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <ClockIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-800 font-medium mb-1">What this does:</p>
              <ul className="text-blue-700 space-y-1 ml-2">
                <li>• Find leads assigned to user_2y2V1dGLmNQZ6JqpNqLz8YKQN2k</li>
                <li>• Filter by current status (assigned, new, etc.)</li>
                <li>• Bulk migrate selected leads to "follow_up" status</li>
                <li>• Provides detailed migration results and error handling</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Manage Lead Status Migration</h3>
            <p className="text-sm text-gray-600">Migrate leads to follow-up status for priority handling</p>
          </div>
          <a
            href="/dashboard/settings/follow-up-migration"
            className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <UsersIcon className="h-5 w-5 mr-2" />
            Open Migration Tool
          </a>
        </div>
      </div>

      {/* Results Section */}
      {webhookResult && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            {webhookResult.success ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
            ) : (
              <XMarkIcon className="h-6 w-6 text-red-600 mr-3" />
            )}
            <h3 className="text-lg font-semibold">
              {webhookResult.success ? 'Webhook Results' : 'Error'}
            </h3>
          </div>

          {/* Summary */}
          <div className={`rounded-lg p-4 mb-6 ${
            webhookResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              webhookResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {webhookResult.message}
            </p>
            
            {webhookResult.success && webhookResult.processedCount > 0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-green-700">Total Processed</p>
                  <p className="text-green-900 font-bold text-lg">{webhookResult.processedCount}</p>
                </div>
                <div>
                  <p className="text-green-700">Successful</p>
                  <p className="text-green-900 font-bold text-lg">{webhookResult.successCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-green-700">Failed</p>
                  <p className="text-green-900 font-bold text-lg">{webhookResult.errorCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-green-700">Date Checked</p>
                  <p className="text-green-900 font-bold text-sm">{webhookResult.currentDate}</p>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Results */}
          {webhookResult.success && webhookResult.appointments && webhookResult.appointments.length > 0 && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">Webhook Details</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {webhookResult.appointments.map((appt, index) => (
                  <div key={index} className={`p-3 rounded-lg ${
                    appt.status === 'success' 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {appt.leadName || 'Unknown Lead'} ({appt.leadPhone || 'No Phone'})
                        </p>
                        <p className="text-sm text-gray-600">
                          Appointment #{appt.appointmentId} at {appt.startTime}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        appt.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                    {appt.message && (
                      <p className={`text-sm mt-1 ${
                        appt.status === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {appt.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 