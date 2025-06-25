export type Borrower = {
  id: number;
  atom_borrower_id?: string; // For cross-referencing with another system
  
  // Basic Information
  full_name: string;
  phone_number: string;
  phone_number_2?: string | null;
  phone_number_3?: string | null;
  email?: string | null;
  residential_status?: string | null;
  status: string;
  source?: string | null;

  // Identity Information
  aa_status: string;
  id_type: string;
  id_number?: string;
  
  // Employment & Income Information
  income_document_type?: string;
  current_employer?: string;
  average_monthly_income?: string;
  annual_income?: string;
  
  // Loan Information
  estimated_reloan_amount?: string;
  loan_product?: string;
  loan_id?: string;
  next_due_date?: Date | string | null;
  loan_completed_date?: Date | string | null;
  latest_completed_loan_date?: Date | string | null;
  
  // Loan Flags
  is_bd_loan?: boolean;
  is_bhv1_loan?: boolean;
  is_overdue_loan?: boolean;
  is_dnc?: boolean;
  
  // Additional Financial Information
  credit_score?: string;
  loan_amount?: string;
  loan_status?: string | null;
  loan_notes?: string | null;
  lead_score?: number;
  financial_commitment_change?: string;
  contact_preference?: string;
  communication_language?: string;
  follow_up_date?: Date | string | null;
  
  // System Fields
  assigned_to?: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted?: boolean;
  
  // Relationship fields (from joins)
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  
  // UI/state fields
  userRole?: string;
  latest_appointment?: object;
  note?: {
    desc?: string;
  };
};

export type BorrowerStatus = 
  | 'active'
  | 'inactive' 
  | 'completed'
  | 'defaulted'
  | 'restructured';

export type AAStatus = 'yes' | 'no' | 'pending';

export type IDType = 'singapore_nric' | 'singapore_pr' | 'fin';

export type IncomeDocumentType = 'bank_statement' | 'noa' | 'cpf';

export type FinancialCommitmentChange = 
  | 'increased'
  | 'decreased' 
  | 'same'
  | 'not_applicable';

export type LoanPlan = {
  id: number;
  loan_id: string;
  borrower_id: number;
  plan_name?: string;
  plan_details?: object;
  interest_rate?: string;
  loan_amount?: string;
  loan_tenure?: string;
  monthly_installment?: string;
  is_selected?: boolean;
  created_at: Date | string;
  updated_at?: Date | string | null;
  created_by?: string;
  updated_by?: string;
}; 