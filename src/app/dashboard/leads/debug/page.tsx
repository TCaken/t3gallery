"use client";

import { useState, useEffect } from 'react';
import { fetchFilteredLeads, getAvailableAgents, getFilterOptions } from '~/app/_actions/leadActions';

interface Playbook {
  id: number;
  name: string;
  samespace_playbook_id: string;
  contact_count: number;
  filter_status?: ('new' | 'assigned' | 'no_answer' | 'follow_up' | 'booked' | 'done' | 'missed/RS' | 'unqualified' | 'give_up' | 'blacklisted')[];
  filter_sources?: string[];
  filter_assigned_to?: string[];
  filter_include_unassigned?: boolean;
}

export default function LeadsDebugPage() {
  const [filterOptions, setFilterOptions] = useState<{
    sources: string[];
    employmentStatuses: string[];
    loanPurposes: string[];
    residentialStatuses: string[];
    leadTypes: string[];
    eligibilityStatuses: string[];
  }>({
    sources: [],
    employmentStatuses: [],
    loanPurposes: [],
    residentialStatuses: [],
    leadTypes: [],
    eligibilityStatuses: []
  });

  const [availableAgents, setAvailableAgents] = useState<{id: string, name: string, email: string | null}[]>([]);
  const [results, setResults] = useState<{ success: boolean; leads?: any[]; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expectedCount, setExpectedCount] = useState<number>(0);
  const [actualCount, setActualCount] = useState<number>(0);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [playbookResults, setPlaybookResults] = useState<{ success: boolean; leads?: any[]; error?: string } | null>(null);
  const [playbookCount, setPlaybookCount] = useState<number>(0);

  // Test filters - manually configurable
  const [testFilters, setTestFilters] = useState<{
    status: ('new' | 'assigned' | 'no_answer' | 'follow_up' | 'booked' | 'done' | 'missed/RS' | 'unqualified' | 'give_up' | 'blacklisted')[];
    includeUnassigned: boolean;
    assignedTo: string[];
  }>({
    status: ['new', 'assigned'],
    includeUnassigned: true,
    assignedTo: []
  });

  useEffect(() => {
    void loadFilterOptions();
    void loadAgents();
    void loadPlaybooks();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const result = await getFilterOptions();
      if (result.success && result.options) {
        // Filter out null values
        setFilterOptions({
          sources: result.options.sources.filter(Boolean) as string[],
          employmentStatuses: result.options.employmentStatuses.filter(Boolean) as string[],
          loanPurposes: result.options.loanPurposes.filter(Boolean) as string[],
          residentialStatuses: result.options.residentialStatuses.filter(Boolean) as string[],
          leadTypes: result.options.leadTypes.filter(Boolean) as string[],
          eligibilityStatuses: result.options.eligibilityStatuses.filter(Boolean) as string[]
        });
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const result = await getAvailableAgents();
      if (result.success && result.agents) {
        setAvailableAgents(result.agents);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const loadPlaybooks = async () => {
    try {
      // Mock playbooks for now - you can replace this with actual API call
      const mockPlaybooks: Playbook[] = [
        {
          id: 1,
          name: "Test Playbook 1",
          samespace_playbook_id: "playbook_123",
          contact_count: 45,
          filter_status: ['new', 'assigned'],
          filter_sources: ['SEO'],
          filter_assigned_to: [],
          filter_include_unassigned: true
        },
        {
          id: 2,
          name: "Test Playbook 2", 
          samespace_playbook_id: "playbook_456",
          contact_count: 23,
          filter_status: ['follow_up', 'booked'],
          filter_sources: ['MoneyRight'],
          filter_assigned_to: [],
          filter_include_unassigned: false
        }
      ];
      setPlaybooks(mockPlaybooks);
    } catch (error) {
      console.error('Error loading playbooks:', error);
    }
  };

  const runFilterTest = async () => {
    setIsLoading(true);
    setResults(null);
    setActualCount(0);

    try {
      console.log('🔍 [DEBUG] === STARTING FILTER TEST ===');
      console.log('🔍 [DEBUG] Test filters:', testFilters);
      
      // Log detailed filter breakdown
      console.log('🔍 [DEBUG] === FILTER BREAKDOWN ===');
      console.log('🔍 [DEBUG] Status Filter:', testFilters.status);
      console.log('🔍 [DEBUG] Assigned To:', testFilters.assignedTo);
      console.log('🔍 [DEBUG] Include Unassigned:', testFilters.includeUnassigned);
      console.log('🔍 [DEBUG] Filter Logic:', {
        hasStatusFilter: testFilters.status && testFilters.status.length > 0,
        hasAssignmentFilter: testFilters.assignedTo && testFilters.assignedTo.length > 0,
        includeUnassigned: testFilters.includeUnassigned,
        totalFilters: (testFilters.status?.length || 0) + (testFilters.assignedTo?.length || 0) + (testFilters.includeUnassigned ? 1 : 0)
      });

      const result = await fetchFilteredLeads({
        searchQuery: '',
        searchOptions: testFilters,
        sortOptions: { sortBy: 'updated_at', sortOrder: 'desc' },
        page: 1,
        limit: 1000 // Get more results for testing
      });

      console.log('🔍 [DEBUG] === FILTER EXECUTION RESULTS ===');
      console.log('🔍 [DEBUG] Filter test result:', result);
      console.log('🔍 [DEBUG] Success:', result.success);
      console.log('🔍 [DEBUG] Leads found:', result.leads?.length || 0);
      console.log('🔍 [DEBUG] Has more:', result.hasMore);
      
      setResults(result);

      if (result.success && result.leads) {
        const count = result.leads.length;
        setActualCount(count);
        
        console.log(`🔍 [DEBUG] === PLAYBOOK CONTACT ANALYSIS ===`);
        console.log(`🔍 [DEBUG] Filter returned ${count} leads`);
        console.log(`🔍 [DEBUG] Playbook would have ${count} contacts (1:1 mapping)`);
        console.log(`🔍 [DEBUG] Expected: ${expectedCount}, Actual: ${count}`);
        
        if (expectedCount > 0) {
          const difference = Math.abs(count - expectedCount);
          const percentage = ((difference / expectedCount) * 100).toFixed(2);
          console.log(`🔍 [DEBUG] Difference: ${difference} (${percentage}%)`);
          console.log(`🔍 [DEBUG] Status: ${difference === 0 ? '✅ MATCH' : '⚠️ MISMATCH'}`);
        }
        
        // Log sample leads
        if (result.leads.length > 0) {
          console.log('🔍 [DEBUG] === SAMPLE LEADS (First 3) ===');
          result.leads.slice(0, 3).forEach((lead: any, index: number) => {
            console.log(`🔍 [DEBUG] Lead ${index + 1}:`, {
              id: lead.id,
              name: lead.full_name,
              status: lead.status,
              assigned_to: lead.assigned_to,
              source: lead.source
            });
          });
        }
      }

    } catch (error) {
      console.error('Error running filter test:', error);
      setResults({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setPlaybookCount(playbook.contact_count);
    
    console.log('🔍 [DEBUG] Selected playbook:', playbook);
    console.log('🔍 [DEBUG] Playbook filters:', {
      status: playbook.filter_status || [],
      sources: playbook.filter_sources || [],
      assignedTo: playbook.filter_assigned_to || [],
      includeUnassigned: playbook.filter_include_unassigned || false
    });
  };

  const runPlaybookComparison = async () => {
    if (!selectedPlaybook) return;
    
    setIsLoading(true);
    setPlaybookResults(null);

    try {
      console.log('🔍 [DEBUG] Running playbook comparison for:', selectedPlaybook.name);
      
      // Build playbook filters
      const playbookFilters = {
        status: selectedPlaybook.filter_status || [],
        sources: selectedPlaybook.filter_sources || [],
        assignedTo: selectedPlaybook.filter_assigned_to || [],
        includeUnassigned: selectedPlaybook.filter_include_unassigned || false
      };

      console.log('🔍 [DEBUG] Using playbook filters:', playbookFilters);

      const result = await fetchFilteredLeads({
        searchQuery: '',
        searchOptions: playbookFilters,
        sortOptions: { sortBy: 'updated_at', sortOrder: 'desc' },
        page: 1,
        limit: 1000
      });

      console.log('🔍 [DEBUG] Playbook filter result:', result);
      setPlaybookResults(result);

      if (result.success && result.leads) {
        const count = result.leads.length;
        console.log(`🔍 [DEBUG] Playbook filters returned ${count} leads`);
        console.log(`🔍 [DEBUG] Playbook contact count: ${selectedPlaybook.contact_count}`);
        
        const difference = Math.abs(count - selectedPlaybook.contact_count);
        const percentage = ((difference / selectedPlaybook.contact_count) * 100).toFixed(2);
        console.log(`🔍 [DEBUG] Difference: ${difference} (${percentage}%)`);
      }

    } catch (error) {
      console.error('Error running playbook comparison:', error);
      setPlaybookResults({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFilter = (key: string, value: any) => {
    setTestFilters((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const updateArrayFilter = (key: string, value: string, checked: boolean) => {
    setTestFilters((prev: any) => {
      const currentArray = prev[key] || [];
      if (checked) {
        return { ...prev, [key]: [...currentArray, value] };
      } else {
        return { ...prev, [key]: currentArray.filter((item: string) => item !== value) };
      }
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Filter System Test - Playbook Contact Creation</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playbook Contact Analysis Panel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Playbook Contact Analysis</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Expected Playbook Contacts</label>
            <input
              type="number"
              placeholder="Enter expected number of contacts"
              value={expectedCount || ''}
              onChange={(e) => setExpectedCount(e.target.value ? parseInt(e.target.value) : 0)}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter how many contacts you expect this filter to create in a playbook
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded mb-4">
            <h4 className="font-medium text-blue-900 mb-2">How Playbooks Determine Contacts</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Playbooks use the same filtering logic as the leads page</p>
              <p>• They apply your configured filters to find matching leads</p>
              <p>• Each matching lead becomes a contact in the playbook</p>
              <p>• The contact count should match the filtered lead count</p>
            </div>
          </div>

          <button
            onClick={runFilterTest}
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Filter for Playbook Contacts'}
          </button>
        </div>

        {/* Filter Configuration Panel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Configure Manual Filters</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Expected Contact Count</label>
            <input
              type="number"
              placeholder="Enter expected number of contacts"
              value={expectedCount || ''}
              onChange={(e) => setExpectedCount(e.target.value ? parseInt(e.target.value) : 0)}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the number of contacts you expect this filter to create
            </p>
          </div>
          
          {/* Status Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Lead Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'done', 'missed/RS', 'unqualified', 'give_up', 'blacklisted'] as const).map(status => (
                <label key={status} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={testFilters.status?.includes(status) || false}
                    onChange={(e) => updateArrayFilter('status', status, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Assigned To Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Assigned To</label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {availableAgents.map(agent => (
                <label key={agent.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={testFilters.assignedTo?.includes(agent.id) || false}
                    onChange={(e) => updateArrayFilter('assignedTo', agent.id, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">{agent.name} ({agent.email || 'No email'})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Include Unassigned */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={testFilters.includeUnassigned || false}
                onChange={(e) => updateFilter('includeUnassigned', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Include Unassigned Leads</span>
            </label>
          </div>

          <button
            onClick={runFilterTest}
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing Filters...' : 'Test Filter System'}
          </button>
        </div>

        {/* Playbook Contact Analysis Results */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Playbook Contact Analysis Results</h2>
          
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Analyzing filters for playbook contacts...</p>
            </div>
          )}

          {!isLoading && actualCount > 0 && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                expectedCount > 0 && Math.abs(actualCount - expectedCount) === 0 
                  ? 'bg-green-50 text-green-800' 
                  : expectedCount > 0 
                    ? 'bg-yellow-50 text-yellow-800'
                    : 'bg-blue-50 text-blue-800'
              }`}>
                <h3 className="font-bold text-lg mb-2">
                  {expectedCount > 0 && Math.abs(actualCount - expectedCount) === 0 
                    ? '✅ PLAYBOOK CONTACTS MATCH EXPECTED' 
                    : expectedCount > 0 
                      ? '⚠️ PLAYBOOK CONTACTS MISMATCH'
                      : '📊 FILTER ANALYSIS RESULTS'
                  }
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Filter Would Return:</strong> {actualCount} leads</p>
                  <p><strong>Playbook Would Have:</strong> {actualCount} contacts</p>
                  {expectedCount > 0 && (
                    <>
                      <p><strong>Expected Contacts:</strong> {expectedCount}</p>
                      <p><strong>Difference:</strong> {Math.abs(actualCount - expectedCount)} ({((Math.abs(actualCount - expectedCount) / expectedCount) * 100).toFixed(2)}%)</p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium mb-2">Filters Applied (Same as Playbook Logic)</h4>
                <div className="text-xs space-y-1">
                  <p><strong>Status:</strong> {testFilters.status?.join(', ') || 'All'}</p>
                  <p><strong>Assigned To:</strong> {testFilters.assignedTo?.join(', ') || 'All'}</p>
                  <p><strong>Unassigned:</strong> {testFilters.includeUnassigned ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {results?.success && results.leads && results.leads.length > 0 && (
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium mb-2">Sample Leads That Would Become Contacts (First 3)</h4>
                  <div className="space-y-2">
                    {results.leads.slice(0, 3).map((lead: any, index: number) => (
                      <div key={index} className="text-xs border-b pb-1">
                        <p><strong>ID:</strong> {lead.id} | <strong>Name:</strong> {lead.full_name || 'N/A'}</p>
                        <p><strong>Status:</strong> {lead.status} | <strong>Source:</strong> {lead.source || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isLoading && actualCount === 0 && results && (
            <div className="text-center py-8 text-gray-500">
              <p>No leads found with the current filters</p>
              <p className="text-sm mt-2">This filter would create a playbook with 0 contacts</p>
            </div>
          )}

          {!isLoading && !results && (
            <div className="text-center py-8 text-gray-500">
              <p>Configure filters and analyze to see playbook contact results</p>
            </div>
          )}
        </div>

        {/* Detailed Filter Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Detailed Filter Breakdown</h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">🔍 How Filters Are Applied</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>1. Status Filter:</strong> {testFilters.status?.length ? `Only leads with status: ${testFilters.status.join(', ')}` : 'All statuses allowed'}</p>
                <p><strong>2. Assignment Filter:</strong> {
                  testFilters.assignedTo?.length 
                    ? testFilters.includeUnassigned 
                      ? `Leads assigned to: ${testFilters.assignedTo.join(', ')} OR unassigned leads`
                      : `Only leads assigned to: ${testFilters.assignedTo.join(', ')}`
                    : testFilters.includeUnassigned 
                      ? 'Only unassigned leads'
                      : 'All assignment types allowed'
                }</p>
                <p><strong>3. Result:</strong> Each matching lead becomes 1 contact in the playbook</p>
              </div>
            </div>

            {results?.success && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900 mb-3">✅ Filter Execution Results</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <p><strong>Total Leads Found:</strong> {results.leads?.length || 0}</p>
                  <p><strong>SQL Query Conditions:</strong> {results.leads?.length ? 'Successfully executed' : 'No results'}</p>
                  <p><strong>Playbook Contact Count:</strong> {results.leads?.length || 0} (1:1 mapping)</p>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">📋 Filter Configuration Summary</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>Status:</strong> {testFilters.status?.join(', ') || 'All Statuses'}</p>
                <p><strong>Assigned To:</strong> {testFilters.assignedTo?.join(', ') || 'All Agents'}</p>
                <p><strong>Include Unassigned:</strong> {testFilters.includeUnassigned ? 'Yes' : 'No'}</p>
                <p><strong>Filter Logic:</strong> {
                  testFilters.status?.length && testFilters.assignedTo?.length
                    ? 'Status AND Assignment filters combined'
                    : testFilters.status?.length
                      ? 'Status filter only'
                      : testFilters.assignedTo?.length
                        ? 'Assignment filter only'
                        : 'No filters applied'
                }</p>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-900">How to Test Filter System for Playbook Contact Creation</h2>
        <div className="text-blue-800 space-y-2">
          <p>1. <strong>Set Expected Count:</strong> Enter how many contacts you expect this filter to create</p>
          <p>2. <strong>Configure Filters:</strong> Set up the filters exactly as you would in the leads page</p>
          <p>3. <strong>Run Test:</strong> Click "Test Filter System" to see how many leads the filter returns</p>
          <p>4. <strong>Check Console:</strong> Open browser console to see detailed SQL query information</p>
          <p>5. <strong>Compare Results:</strong> See if the filter returns the expected number of leads</p>
        </div>
        <div className="mt-4 p-4 bg-blue-100 rounded">
          <p className="text-sm text-blue-900">
            <strong>What This Tests:</strong>
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1">
            <li>• Whether your filter logic returns the expected number of leads</li>
            <li>• If the filtering system works correctly for playbook contact creation</li>
            <li>• SQL query generation and execution</li>
            <li>• Filter condition logic and combinations</li>
          </ul>
        </div>
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p className="text-sm text-green-900">
            <strong>Why This Helps:</strong>
          </p>
          <ul className="text-sm text-green-800 mt-2 space-y-1">
            <li>• Test filters before creating playbooks</li>
            <li>• Debug filter logic issues</li>
            <li>• Ensure playbook contact counts will be accurate</li>
            <li>• Validate filter combinations work as expected</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
