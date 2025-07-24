"use client";

import { useState, useEffect } from 'react';
import { ChevronDownIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getAvailableAgents, getAppointmentCreators } from '~/app/_actions/leadActions';

// Types for the component
export interface FilterOptions {
  status?: ('new' | 'assigned' | 'no_answer' | 'follow_up' | 'booked' | 'done' | 'missed/RS' | 'unqualified' | 'give_up' | 'blacklisted')[];
  assignedTo?: string[];
  includeUnassigned?: boolean;
  bookedBy?: string[];
  sources?: string[];
  employmentStatuses?: string[];
  loanPurposes?: string[];
  residentialStatuses?: string[];
  leadTypes?: string[];
  eligibilityStatuses?: string[];
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  followUpDateFrom?: string;
  followUpDateTo?: string;
  assignedInLastDays?: number;
}

export interface SortOptions {
  sortBy?: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number' | 'employment_salary' | 'lead_score' | 'follow_up_date';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterComponentProps {
  // Current filter state
  filterOptions: FilterOptions;
  sortOptions: SortOptions;
  searchQuery: string;
  
  // Callbacks for updates
  onFilterChange: (filters: FilterOptions) => void;
  onSortChange: (sort: SortOptions) => void;
  onSearchChange: (query: string) => void;
  onApplyFilters: () => void;
  
  // Role-based configuration
  userRole?: string;
  userId?: string;
  
  // UI configuration
  isCompact?: boolean;
  showAdvancedFilters?: boolean;
}

// Sorting options configuration
const SORTING_OPTIONS = [
  { value: 'updated_at_desc', label: 'Recently Updated', sortBy: 'updated_at' as const, sortOrder: 'desc' as const },
  { value: 'updated_at_asc', label: 'Oldest Updated', sortBy: 'updated_at' as const, sortOrder: 'asc' as const },
  { value: 'created_at_desc', label: 'Recently Created', sortBy: 'created_at' as const, sortOrder: 'desc' as const },
  { value: 'created_at_asc', label: 'Oldest Created', sortBy: 'created_at' as const, sortOrder: 'asc' as const },
  { value: 'full_name_asc', label: 'Name A-Z', sortBy: 'full_name' as const, sortOrder: 'asc' as const },
  { value: 'full_name_desc', label: 'Name Z-A', sortBy: 'full_name' as const, sortOrder: 'desc' as const },
  { value: 'amount_desc', label: 'Amount High-Low', sortBy: 'amount' as const, sortOrder: 'desc' as const },
  { value: 'amount_asc', label: 'Amount Low-High', sortBy: 'amount' as const, sortOrder: 'asc' as const },
  { value: 'follow_up_date_asc', label: 'Follow Up Date (Soonest)', sortBy: 'follow_up_date' as const, sortOrder: 'asc' as const },
  { value: 'follow_up_date_desc', label: 'Follow Up Date (Latest)', sortBy: 'follow_up_date' as const, sortOrder: 'desc' as const },
  { value: 'lead_score_desc', label: 'Lead Score High-Low', sortBy: 'lead_score' as const, sortOrder: 'desc' as const },
  { value: 'lead_score_asc', label: 'Lead Score Low-High', sortBy: 'lead_score' as const, sortOrder: 'asc' as const },
  { value: 'id_desc', label: 'ID High-Low', sortBy: 'id' as const, sortOrder: 'desc' as const },
  { value: 'id_asc', label: 'ID Low-High', sortBy: 'id' as const, sortOrder: 'asc' as const }
];

// Lead status options
const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'assigned', label: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'missed/RS', label: 'Missed/RS', color: 'bg-red-100 text-red-800' },
  { value: 'booked', label: 'Booked', color: 'bg-green-100 text-green-800' },
  { value: 'give_up', label: 'Give Up', color: 'bg-red-100 text-red-800' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-800' },
  { value: 'unqualified', label: 'Duplicate/Reloan', color: 'bg-orange-100 text-orange-800' },
  { value: 'blacklisted', label: 'Blacklisted', color: 'bg-black text-white' },
];

export default function LeadsFilterComponent({
  filterOptions,
  sortOptions,
  searchQuery,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onApplyFilters,
  userRole,
  userId,
  isCompact = false,
  showAdvancedFilters = false
}: FilterComponentProps) {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const [availableAgents, setAvailableAgents] = useState<{id: string, name: string, email: string}[]>([]);
  const [appointmentCreators, setAppointmentCreators] = useState<{id: string, name: string, email: string}[]>([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Load dropdown data
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [agentsResult, creatorsResult] = await Promise.all([
          getAvailableAgents(),
          getAppointmentCreators()
        ]);

        if (agentsResult.success && agentsResult.agents) {
          const validAgents = agentsResult.agents.filter(agent => agent.email !== null) as {id: string, name: string, email: string}[];
          setAvailableAgents(validAgents);
        }

        if (creatorsResult.success && creatorsResult.creators) {
          const validCreators = creatorsResult.creators.filter(creator => creator.email !== null) as {id: string, name: string, email: string}[];
          setAppointmentCreators(validCreators);
        }
      } catch (error) {
        console.error('Error loading dropdown data:', error);
      }
    };

    void loadDropdownData();
  }, []);

  // Calculate active filters count
  useEffect(() => {
    let count = 0;
    if (filterOptions.status && filterOptions.status.length > 0) count++;
    if (filterOptions.assignedTo && filterOptions.assignedTo.length > 0) count++;
    if (filterOptions.includeUnassigned) count++;
    if (filterOptions.bookedBy && filterOptions.bookedBy.length > 0) count++;
    if (searchQuery && searchQuery.trim() !== '') count++;
    setActiveFiltersCount(count);
  }, [filterOptions, searchQuery]);

  // Get current sorting option value
  const getCurrentSortingValue = () => {
    const current = SORTING_OPTIONS.find(opt => 
      opt.sortBy === sortOptions.sortBy && opt.sortOrder === sortOptions.sortOrder
    );
    return current?.value ?? 'updated_at_desc';
  };

  // Handle search query change
  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    
    // If search is active, reset other filters to avoid conflicts
    if (value.trim() !== '') {
      onFilterChange({
        status: LEAD_STATUSES.map(s => s.value) as FilterOptions['status'],
        assignedTo: [],
        includeUnassigned: true,
        bookedBy: []
      });
    }
    // Note: Don't reset to defaults when search is cleared - maintain current filter state
  };

  // Handle multi-select change
  const handleMultiSelectChange = (
    field: keyof FilterOptions,
    value: string,
    checked: boolean
  ) => {
    const currentValues = (filterOptions[field] as string[]) ?? [];
    let newValues: string[];
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter(v => v !== value);
    }
    
    onFilterChange({
      ...filterOptions,
      [field]: field === 'status' ? newValues as FilterOptions['status'] : newValues
    });
  };

  // Handle boolean filter change
  const handleBooleanChange = (field: keyof FilterOptions, checked: boolean) => {
    onFilterChange({
      ...filterOptions,
      [field]: checked
    });
  };

  // Handle sorting change
  const handleSortingChange = (value: string) => {
    const selectedOption = SORTING_OPTIONS.find(opt => opt.value === value);
    if (selectedOption) {
      onSortChange({
        sortBy: selectedOption.sortBy,
        sortOrder: selectedOption.sortOrder
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    onSearchChange('');
    onFilterChange({});
    onSortChange({ sortBy: 'updated_at', sortOrder: 'desc' });
    onApplyFilters();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <FunnelIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeFiltersCount} active
            </span>
          )}
          {isApplying && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Applied
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          )}
          
          {isCompact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <ChevronDownIcon 
                className={`h-5 w-5 text-gray-500 transform transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`} 
              />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!isCompact || isExpanded) && (
        <div className="p-4 space-y-6">
          {/* Search Bar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by phone, ID, or name..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-blue-500 focus:outline-none"
                value={searchQuery}
                onChange={(e) => {
                  handleSearchChange(e.target.value);
                  // Auto-apply after a short delay to avoid excessive API calls
                  setTimeout(() => onApplyFilters(), 500);
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {/* All Status Option */}
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterOptions.status?.length === LEAD_STATUSES.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allStatuses = LEAD_STATUSES.map(s => s.value) as FilterOptions['status'];
                        onFilterChange({ ...filterOptions, status: allStatuses });
                        setIsApplying(true);
                        onApplyFilters();
                        setTimeout(() => setIsApplying(false), 1000);
                      } else {
                        onFilterChange({ ...filterOptions, status: [] });
                        onApplyFilters();
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-bold text-blue-600">All Statuses</span>
                </label>
                
                {LEAD_STATUSES.map((status) => (
                  <label key={status.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filterOptions.status?.some(s => s === status.value) ?? false}
                      onChange={(e) => {
                        handleMultiSelectChange('status', status.value, e.target.checked);
                        onApplyFilters();
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className={`text-sm px-2 py-1 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Assigned To Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {/* All Assigned Option */}
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterOptions.includeUnassigned && filterOptions.assignedTo?.length === availableAgents.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onFilterChange({ 
                          ...filterOptions, 
                          includeUnassigned: true,
                          assignedTo: availableAgents.map(a => a.id)
                        });
                        onApplyFilters();
                      } else {
                        onFilterChange({ 
                          ...filterOptions, 
                          includeUnassigned: false,
                          assignedTo: []
                        });
                        onApplyFilters();
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-bold text-purple-600">All (Assigned + Unassigned)</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterOptions.includeUnassigned ?? false}
                    onChange={(e) => {
                      handleBooleanChange('includeUnassigned', e.target.checked);
                      onApplyFilters();
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-blue-600">Unassigned Leads</span>
                </label>
                
                {availableAgents.map((agent) => (
                  <label key={agent.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filterOptions.assignedTo?.includes(agent.id) ?? false}
                      onChange={(e) => {
                        handleMultiSelectChange('assignedTo', agent.id, e.target.checked);
                        onApplyFilters();
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{agent.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Booked By Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booked By
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {appointmentCreators.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No appointment creators found</div>
                ) : (
                  <>
                    {/* All Booked By Option */}
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={filterOptions.bookedBy?.length === appointmentCreators.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFilterChange({ 
                              ...filterOptions, 
                              bookedBy: appointmentCreators.map(c => c.id)
                            });
                            onApplyFilters();
                          } else {
                            onFilterChange({ 
                              ...filterOptions, 
                              bookedBy: []
                            });
                            onApplyFilters();
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-bold text-green-600">All Creators</span>
                    </label>
                    
                    {appointmentCreators.map((creator) => (
                      <label key={creator.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filterOptions.bookedBy?.includes(creator.id) ?? false}
                          onChange={(e) => {
                            handleMultiSelectChange('bookedBy', creator.id, e.target.checked);
                            onApplyFilters();
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{creator.name}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Created Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Created Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="From Date"
                  value={filterOptions.dateFrom ?? ''}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterOptions,
                      dateFrom: e.target.value || undefined
                    });
                    onApplyFilters();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={filterOptions.dateTo ?? ''}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterOptions,
                      dateTo: e.target.value || undefined
                    });
                    onApplyFilters();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Follow Up Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow Up Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="From Date"
                  value={filterOptions.followUpDateFrom ?? ''}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterOptions,
                      followUpDateFrom: e.target.value || undefined
                    });
                    onApplyFilters();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={filterOptions.followUpDateTo ?? ''}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterOptions,
                      followUpDateTo: e.target.value || undefined
                    });
                    onApplyFilters();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sorting Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={getCurrentSortingValue()}
              onChange={(e) => {
                handleSortingChange(e.target.value);
                onApplyFilters();
              }}
              className="w-full md:w-auto rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              {SORTING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
} 