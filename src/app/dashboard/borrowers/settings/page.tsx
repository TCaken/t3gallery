"use client";

import { useState } from "react";
import { 
  fetchExternalBorrowers, 
  type ExternalBorrowerData,
  type ParsedLoan
} from "~/app/_actions/borrowerSync";

// Type for sync results
type SyncResults = {
  total: number;
  created: number;
  updated: number;
  errors: number;
  details: Array<{ borrower_id: string; action: string; error?: string }>;
};

export default function BorrowersSettingsPage() {
  const [externalData, setExternalData] = useState<ExternalBorrowerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingRawData, setIsShowingRawData] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<ExternalBorrowerData | null>(null);
  const [message, setMessage] = useState<string>("");
  const [lastTwoDigit, setLastTwoDigit] = useState<string>("02");

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleFetchData = async () => {
    setIsLoading(true);
    try {
      const result = await fetchExternalBorrowers(lastTwoDigit);
      if (result.success) {
        setExternalData(result.data);
        showMessage(`✅ Fetched ${result.data.length} borrowers from external API (last_two_digits=${lastTwoDigit})`);
      }
    } catch (error) {
      showMessage(`❌ ${error instanceof Error ? error.message : "Failed to fetch data"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAll = async () => {
    if (externalData.length === 0) {
      showMessage("❌ No data to sync. Please fetch data first.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/borrowers/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lastTwoDigit }),
      });

      const result = await response.json();
      
      if (result.success) {
        setSyncResults(result.results);
        showMessage(`✅ Sync completed (${lastTwoDigit}): ${result.results.created} created, ${result.results.updated} updated, ${result.results.errors} errors`);
      } else {
        showMessage(`❌ ${result.message || "Failed to sync borrowers"}`);
      }
    } catch (error) {
      showMessage(`❌ ${error instanceof Error ? error.message : "Failed to sync borrowers"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const parseLoansForDisplay = (loansString: string): ParsedLoan[] => {
    try {
      if (!loansString || loansString.trim() === '""' || loansString.trim() === '') {
        return [];
      }
      const cleanedString = loansString.replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"');
      const loans: ParsedLoan[] = JSON.parse(cleanedString);
      return Array.isArray(loans) ? loans : [];
    } catch (error) {
      return [];
    }
  };

  // Helper function to get loans as ParsedLoan array
  const getLoansArray = (loans: string | ParsedLoan[]): ParsedLoan[] => {
    if (Array.isArray(loans)) {
      return loans;
    }
    return parseLoansForDisplay(loans);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Borrower Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage borrower data synchronization with external API
          </p>
        </div>

        {/* Documentation Section */}
        <div style={{ 
          marginBottom: "30px", 
          padding: "20px", 
          backgroundColor: "#f8f9fa", 
          border: "1px solid #e9ecef", 
          borderRadius: "8px" 
        }}>
          <h2 style={{ fontSize: "18px", marginBottom: "15px", color: "#495057" }}>
            📚 How Borrower-Loan Plan Sync Works
          </h2>
          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#6c757d" }}>
            <div style={{ marginBottom: "15px" }}>
              <strong>Primary Loan Selection (for borrower record):</strong>
              <ol style={{ marginLeft: "20px", marginTop: "5px" }}>
                <li>🔴 <strong>Highest Priority:</strong> Active overdue loan</li>
                <li>🟡 <strong>Medium Priority:</strong> Any active loan (not completed)</li>
                <li>🟢 <strong>Lowest Priority:</strong> Most recent completed loan</li>
              </ol>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <strong>Data Mapping:</strong>
              <ul style={{ marginLeft: "20px", marginTop: "5px" }}>
                <li><code>borrowers.loan_id</code> ← Primary loan&apos;s loan_id</li>
                <li><code>borrowers.loan_product</code> ← Primary loan&apos;s product_name</li>
                <li><code>borrowers.loan_amount</code> ← Primary loan&apos;s estimated_reloan_amount</li>
              </ul>
            </div>
            <div>
              <strong>Loan Plans Table:</strong>
              <ul style={{ marginLeft: "20px", marginTop: "5px" }}>
                <li>All loans are stored as separate records in <code>loan_plans</code> table</li>
                <li>Primary loan is marked with <code>is_selected = true</code></li>
                <li>Other loans are marked with <code>is_selected = false</code></li>
                <li>This allows tracking full loan history while maintaining primary loan reference</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-200 rounded-lg text-blue-800">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Data Sync Controls</h2>
              <p className="text-gray-600 mb-6">Fetch and synchronize borrower data</p>
              
              <div className="space-y-4">
                {/* Last Two Digit Selector */}
                <div>
                  <label htmlFor="lastTwoDigit" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Two Digits Filter
                  </label>
                  <select
                    id="lastTwoDigit"
                    value={lastTwoDigit}
                    onChange={(e) => setLastTwoDigit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  >
                    {Array.from({ length: 100 }, (_, i) => {
                      const value = i.toString().padStart(2, '0');
                      return (
                        <option key={value} value={value}>
                          {value} - Borrower IDs ending in {value}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which borrowers to fetch based on their ID&apos;s last two digits (00-99)
                  </p>
                </div>

                <button 
                  onClick={handleFetchData} 
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "⏳ Loading..." : `📥 Fetch External Data (Last Two Digits: ${lastTwoDigit})`}
                </button>

                {externalData.length > 0 && (
                  <div className="p-3 bg-green-100 border border-green-200 rounded-lg text-green-800 text-sm">
                    📊 {externalData.length} borrowers fetched from external API (last_two_digits={lastTwoDigit})
                  </div>
                )}

                <button 
                  onClick={handleSyncAll}
                  disabled={isLoading || externalData.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "⏳ Syncing..." : `🔄 Sync All Borrowers (Last Two Digits: ${lastTwoDigit})`}
                </button>

                {syncResults && (
                  <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-sm">
                    ✅ Sync completed: {syncResults.created} created, {syncResults.updated} updated, {syncResults.errors} errors
                  </div>
                )}

                <hr className="my-4" />

                <button
                  onClick={() => setIsShowingRawData(!isShowingRawData)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {isShowingRawData ? "👁️‍🗨️ Hide Raw Data" : "👁️ Show Raw Data"}
                </button>
              </div>
            </div>

            {/* Sync Results Details */}
            {syncResults && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Sync Results</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-medium">{syncResults.total}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Created:</span>
                    <span className="font-medium">{syncResults.created}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Updated:</span>
                    <span className="font-medium">{syncResults.updated}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Errors:</span>
                    <span className="font-medium">{syncResults.errors}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6 pt-6">
                  <button
                    onClick={() => setIsShowingRawData(false)}
                    className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                      !isShowingRawData
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setIsShowingRawData(true)}
                    className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                      isShowingRawData
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Raw Data
                  </button>
                </nav>
              </div>

              {/* Content */}
              <div className="p-6">
                {isShowingRawData ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Raw API Response</h3>
                    <div className="bg-gray-100 rounded-lg p-4 h-96 overflow-auto">
                      <pre className="text-xs text-gray-800">
                        {JSON.stringify(externalData, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedBorrower ? (
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-semibold">{selectedBorrower.borrower_name}</h3>
                          <button 
                            onClick={() => setSelectedBorrower(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            ← Back to List
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="space-y-3">
                            <div><span className="font-medium">Borrower ID:</span> {selectedBorrower.borrower_id}</div>
                            <div><span className="font-medium">Phone:</span> {selectedBorrower.phone_number}</div>
                            <div><span className="font-medium">ID Type:</span> {selectedBorrower.id_type}</div>
                            <div><span className="font-medium">DNC:</span> {selectedBorrower.borrower_has_dnc}</div>
                          </div>
                          <div className="space-y-3">
                            <div><span className="font-medium">Employer:</span> {selectedBorrower.current_employer_name}</div>
                            <div><span className="font-medium">Monthly Income:</span> ${selectedBorrower.average_monthly_income}</div>
                            <div><span className="font-medium">Annual Income:</span> ${selectedBorrower.annually_income}</div>
                            <div><span className="font-medium">Income Doc:</span> {selectedBorrower.income_document_type}</div>
                          </div>
                        </div>
                        
                        <hr className="my-6" />
                        
                        <h4 className="text-lg font-medium mb-4">
                          Loans ({getLoansArray(selectedBorrower.loans).length})
                        </h4>
                        <div className="space-y-4 h-96 overflow-auto">
                          {getLoansArray(selectedBorrower.loans).map((loan, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="font-medium">Loan ID:</span> {loan.loan_id}</div>
                                <div><span className="font-medium">Product:</span> {loan.product_name}</div>
                                <div>
                                  <span className="font-medium">Status:</span>
                                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                    loan.loan_completed_date 
                                      ? 'bg-gray-100 text-gray-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {loan.loan_completed_date ? "Completed" : "Active"}
                                  </span>
                                </div>
                                <div><span className="font-medium">Amount:</span> ${loan.estimated_reloan_amount}</div>
                                {loan.is_overdue === "Yes" && (
                                  <div><span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Overdue</span></div>
                                )}
                                {loan.next_due_date && (
                                  <div><span className="font-medium">Next Due:</span> {loan.next_due_date}</div>
                                )}
                                {loan.loan_completed_date && (
                                  <div><span className="font-medium">Completed:</span> {loan.loan_completed_date}</div>
                                )}
                              </div>
                              
                              {/* Show primary loan indicator */}
                              {(() => {
                                const loans = getLoansArray(selectedBorrower.loans);
                                const overdueLoan = loans.find(l => !l.loan_completed_date && l.is_overdue === "Yes");
                                const activeLoan = loans.find(l => !l.loan_completed_date);
                                const latestCompletedLoan = loans
                                  .filter(l => l.loan_completed_date)
                                  .sort((a, b) => {
                                    const dateA = new Date(a.loan_completed_date ?? 0);
                                    const dateB = new Date(b.loan_completed_date ?? 0);
                                    return dateB.getTime() - dateA.getTime();
                                  })[0];
                                const primaryLoan = overdueLoan ?? activeLoan ?? latestCompletedLoan;
                                const isPrimary = primaryLoan && loan.loan_id === primaryLoan.loan_id;
                                
                                return isPrimary ? (
                                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                        PRIMARY LOAN
                                      </span>
                                      <span className="text-xs text-blue-600">
                                        This loan data will be used in the borrower&apos;s main record
                                      </span>
                                    </div>
                                    <div className="mt-2 text-xs text-blue-700">
                                      <div><strong>Borrower.loan_id:</strong> {loan.loan_id}</div>
                                      <div><strong>Borrower.loan_product:</strong> {loan.product_name}</div>
                                      <div><strong>Borrower.loan_amount:</strong> ${loan.estimated_reloan_amount}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded">
                                    <span className="text-xs text-gray-600">
                                      📄 Will be stored as loan plan record (is_selected = false)
                                    </span>
                                  </div>
                                );
                              })()}
                              
                              {loan.loan_comments && loan.loan_comments.length > 0 && (
                                <div className="mt-3">
                                  <span className="font-medium text-sm">Recent Comments:</span>
                                  <div className="mt-1 text-xs text-gray-600 max-h-20 overflow-auto">
                                    {loan.loan_comments.slice(0, 3).map((comment, commentIdx) => (
                                      <div key={commentIdx} className="border-l-2 border-gray-300 pl-2 mb-1">
                                        {comment}
                                      </div>
                                    ))}
                                    {loan.loan_comments.length > 3 && (
                                      <div className="text-gray-500 italic">... and {loan.loan_comments.length - 3} more</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Borrowers Preview</h3>
                        <div className="h-96 overflow-auto space-y-4">
                          {externalData.map((borrower, idx) => {
                            const loans = getLoansArray(borrower.loans);
                            const hasActiveLoan = loans.some(loan => !loan.loan_completed_date);
                            const hasOverdueLoan = loans.some(loan => loan.is_overdue === "Yes");

                            return (
                              <div 
                                key={idx} 
                                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => setSelectedBorrower(borrower)}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h4 className="text-lg font-semibold">{borrower.borrower_name}</h4>
                                    <p className="text-gray-600">{borrower.phone_number}</p>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      hasActiveLoan 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {hasActiveLoan ? "Active" : "Completed"}
                                    </span>
                                    {hasOverdueLoan && (
                                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Overdue</span>
                                    )}
                                    {borrower.borrower_has_dnc === "Yes" && (
                                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">DNC</span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                                  <div><span className="font-medium">ID:</span> {borrower.borrower_id}</div>
                                  <div><span className="font-medium">Employer:</span> {borrower.current_employer_name}</div>
                                  <div><span className="font-medium">Loans:</span> {loans.length}</div>
                                </div>
                              </div>
                            );
                          })}
                          {externalData.length === 0 && (
                            <div className="text-center text-gray-500 py-12">
                              No data available. Click &ldquo;Fetch External Data&rdquo; to load borrowers.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 