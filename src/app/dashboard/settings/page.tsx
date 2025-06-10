"use client";

import { useState } from 'react';
import { 
  ClockIcon, 
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { triggerTodayAppointmentWebhooks } from '~/app/_actions/appointmentWebhookTrigger';

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

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<WebhookResult | null>(null);

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
          {webhookResult.appointments && webhookResult.appointments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Detailed Results</h4>
              <div className="space-y-3">
                {webhookResult.appointments.map((appointment, index) => (
                  <div
                    key={`${appointment.appointmentId}-${index}`}
                    className={`p-4 rounded-lg border ${
                      appointment.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {appointment.status === 'success' ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                          ) : (
                            <XMarkIcon className="h-4 w-4 text-red-600 mr-2" />
                          )}
                          <span className="font-medium">
                            {appointment.leadName || 'Unknown Lead'}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            (ID: {appointment.appointmentId})
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>📞 Phone: {appointment.leadPhone || 'Not provided'}</p>
                          <p>🕐 Time: {appointment.startTime}</p>
                          <p className={appointment.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                            {appointment.message}
                          </p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {appointment.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {webhookResult.success && webhookResult.processedCount === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <ClockIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600">No appointments found for today ({currentDate})</p>
              <p className="text-sm text-gray-500 mt-1">
                Appointments will appear here when scheduled for the current date in Singapore time
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 