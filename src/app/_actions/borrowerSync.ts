"use server";

import { db } from "~/server/db";
import { borrowers, loan_plans, borrower_actions, logs } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Types for the external API response
export type ExternalBorrowerData = {
  borrower_id: string | number;
  borrower_name: string;
  phone_number: string;
  id_type: string;
  income_document_type: string;
  current_employer_name: string;
  average_monthly_income: string | number;
  annually_income: string | number;
  latest_completed_loan_date: string;
  borrower_has_dnc: string;
  loans: string | ParsedLoan[]; // Allow both string and array formats
  is_in_closed_loan: string;
  is_in_2nd_reloan: string;
  is_in_attrition: string;
  is_in_last_payment_due: string;
  is_in_bhv1: string;
};

export type ExternalApiResponse = {
  data: {
    listBorrowers: {
      items: ExternalBorrowerData[];
    };
  };
};

export type ParsedLoan = {
  has_bd: string;
  has_bhv: string;
  has_dnc: string;
  loan_id: number;
  is_overdue: string;
  product_name: string;
  loan_comments: string[] | null;
  next_due_date: string | null;
  loan_completed_date: string | null;
  estimated_reloan_amount: number;
};

// Fetch borrowers from external API
export async function fetchExternalBorrowers(lastTwoDigit = "2") {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const apikey = process.env.BORROWER_SYNC_API_KEY;
    const response = await fetch(`https://api.capcfintech.com/api/ac/qs?last_two_digit=${lastTwoDigit}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": `${apikey}`,
      },
      body: JSON.stringify({
        query: `query listBorrowers { 
          listBorrowers { 
            items { 
              borrower_id 
              borrower_name 
              phone_number 
              id_type 
              income_document_type 
              current_employer_name 
              average_monthly_income 
              annually_income 
              latest_completed_loan_date 
              borrower_has_dnc 
              loans 
              is_in_closed_loan 
              is_in_2nd_reloan 
              is_in_attrition 
              is_in_last_payment_due 
              is_in_bhv1 
            } 
          } 
        }`
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ExternalApiResponse = await response.json();
    
    // Log the API call
    await db.insert(logs).values({
      description: `Fetched ${data.data.listBorrowers.items.length} borrowers from external API`,
      entity_type: "borrower_sync",
      entity_id: "external_api",
      action: "fetch",
      performed_by: userId,
      timestamp: new Date(),
    });

    return { success: true, data: data.data.listBorrowers.items };

  } catch (error) {
    console.error("Error fetching external borrowers:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch external borrowers");
  }
}

// Parse loans JSON string
function sanitizeJsonString(str: string): string {
  // Replace problematic characters that break JSON parsing
  return str
    // Handle single quotes in strings - escape them
    .replace(/'/g, "\\'")
    // Handle unescaped double quotes within strings
    .replace(/([^\\])"/g, '$1\\"')
    // Handle line breaks and special characters
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // Handle other control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
}

function parseLoans(loansData: string | ParsedLoan[]): ParsedLoan[] {
  try {
    // Handle case where loans is already an array
    if (Array.isArray(loansData)) {
      console.log(`✅ Loans data already parsed as array with ${loansData.length} loans`);
      return loansData;
    }

    // Handle case where loans is a string (existing logic)
    const loansString = loansData; // TypeScript now knows this is a string
    if (!loansString || loansString.trim() === '""' || loansString.trim() === '') {
      return [];
    }

    // Remove outer quotes if wrapped
    let cleanedString = loansString;
    if (cleanedString.startsWith('"') && cleanedString.endsWith('"')) {
      cleanedString = cleanedString.slice(1, -1);
    }
    
    // First pass: handle escaped quotes
    cleanedString = cleanedString.replace(/\\"/g, '"');
    
    // Try parsing as-is first
    try {
      const loans: ParsedLoan[] = JSON.parse(cleanedString);
      return Array.isArray(loans) ? loans : [];
    } catch (firstError) {
      // If that fails, try more aggressive sanitization
      console.log("First parse failed, trying sanitization...");
      
      // Find and fix loan_comments arrays specifically
      cleanedString = cleanedString.replace(
        /"loan_comments":\s*\[(.*?)\]/gs,
                 (match, commentsContent: string) => {
           if (!commentsContent || typeof commentsContent !== 'string' || commentsContent.trim() === '') {
             return '"loan_comments": []';
           }
           
           // Split by commas that are outside of quotes (roughly)
           const comments = commentsContent.split(/",\s*"/).map((comment: string) => {
             // Clean up each comment
             let cleaned = comment.replace(/^"/, '').replace(/"$/, ''); // Remove surrounding quotes
             cleaned = sanitizeJsonString(cleaned); // Sanitize content
             return `"${cleaned}"`; // Re-wrap in quotes
           });
           
           return `"loan_comments": [${comments.join(', ')}]`;
         }
      );
      
      const loans: ParsedLoan[] = JSON.parse(cleanedString);
      return Array.isArray(loans) ? loans : [];
    }
    
  } catch (error) {
    console.error("JSON parsing failed even after sanitization, trying fallback...");
    
    try {
      // Last resort: try to parse without loan_comments
      let fallbackString = loansData as string;
      
      // Remove outer quotes
      if (fallbackString.startsWith('"') && fallbackString.endsWith('"')) {
        fallbackString = fallbackString.slice(1, -1);
      }
      
      // Replace escaped quotes
      fallbackString = fallbackString.replace(/\\"/g, '"');
      
      // Replace problematic loan_comments arrays with empty arrays
      fallbackString = fallbackString.replace(
        /"loan_comments":\s*\[.*?\]/gs,
        '"loan_comments": []'
      );
      
      const loans: ParsedLoan[] = JSON.parse(fallbackString);
      console.log(`Successfully parsed ${loans.length} loans after removing loan_comments`);
      return Array.isArray(loans) ? loans : [];
      
    } catch (fallbackError) {
      console.error("All parsing attempts failed. Skipping loans for this borrower.");
      console.error("Sample data:", typeof loansData === 'string' ? loansData.substring(0, 300) : 'Array format');
      return [];
    }
  }
}

// Convert external ID type to our enum
function convertIdType(externalIdType: string): string {
  switch (externalIdType.toUpperCase()) {
    case 'NRIC':
      return 'singapore_nric';
    case 'PR':
      return 'singapore_pr';
    case 'FIN':
      return 'fin';
    default:
      return 'singapore_nric'; // Default fallback
  }
}

// Convert income document type to our enum
function convertIncomeDocumentType(externalType: string): string {
  switch (externalType.toUpperCase()) {
    case 'CPF':
      return 'cpf';
    case 'IRAS':
    case 'NOA':
      return 'noa';
    case 'PAYSLIP':
    case 'BANK STATEMENT':
      return 'bank_statement';
    default:
      return 'bank_statement'; // Default fallback
  }
}

// Determine borrower source based on performance buckets
function determineBorrowerSource(bucketData: {
  is_in_closed_loan?: string;
  is_in_2nd_reloan?: string;
  is_in_attrition?: string;
  is_in_last_payment_due?: string;
  is_in_bhv1?: string;
}): string {
  // Priority order: Closed Loan (High) → 2nd Reloan (Medium) → Attrition (High) → Last Payment Due (Medium) → BHV1 (Low) → Standard
  
  if (bucketData.is_in_attrition === "Yes") {
    return "Attrition Risk";
  }
  
  if (bucketData.is_in_closed_loan === "Yes") {
    return "Closed Loan";
  }
  
  if (bucketData.is_in_attrition === "Yes") {
    return "Attrition Risk";
  }
  
  if (bucketData.is_in_2nd_reloan === "Yes") {
    return "2nd Reloan";
  }
  
  if (bucketData.is_in_last_payment_due === "Yes") {
    return "Last Payment Due";
  }
  
  if (bucketData.is_in_bhv1 === "Yes") {
    return "BHV1";
  }
  
  return "Not Eligible";
}

// Sync single borrower
export async function syncBorrower(externalData: ExternalBorrowerData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Check if borrower exists by atom_borrower_id
    const existingBorrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.atom_borrower_id, externalData.borrower_id.toString()))
      .limit(1);

    const parsedLoans = parseLoans(externalData.loans);
    
    // Determine borrower flags from loans
    const hasActiveLoan = parsedLoans.some(loan => !loan.loan_completed_date);
    const hasOverdueLoan = parsedLoans.some(loan => loan.is_overdue === "Yes");
    const hasBdLoan = parsedLoans.some(loan => loan.has_bd === "Yes");
    const hasBhvLoan = parsedLoans.some(loan => loan.has_bhv === "Yes");
    
         // Priority order for selecting primary loan:
     // 1. Active loan with overdue status (highest priority)
     // 2. Any active loan (not completed)
     // 3. Most recent completed loan
     const overdueLoan = parsedLoans.find(loan => !loan.loan_completed_date && loan.is_overdue === "Yes");
     const activeLoan = parsedLoans.find(loan => !loan.loan_completed_date);
     const latestCompletedLoan = parsedLoans
       .filter(loan => loan.loan_completed_date)
       .sort((a, b) => {
         const dateA = new Date(a.loan_completed_date ?? 0);
         const dateB = new Date(b.loan_completed_date ?? 0);
         return dateB.getTime() - dateA.getTime();
       })[0];
     
     // Select primary loan based on priority
     const primaryLoan = overdueLoan ?? activeLoan ?? latestCompletedLoan;

     // Determine source first to check if borrower is in any bucket
     const borrowerSource = determineBorrowerSource({
       is_in_closed_loan: externalData.is_in_closed_loan,
       is_in_2nd_reloan: externalData.is_in_2nd_reloan,
       is_in_attrition: externalData.is_in_attrition,
       is_in_last_payment_due: externalData.is_in_last_payment_due,
       is_in_bhv1: externalData.is_in_bhv1,
     });

     // Determine status based on loan activity and bucket membership
     let borrowerStatus: string;
     if (borrowerSource === "Not in All Buckets" || borrowerSource === "Not Eligible") {
       borrowerStatus = "done"; // Force done status for borrowers not in any bucket
    //  } else if (hasActiveLoan) {
    //    borrowerStatus = "new";
    //  } else if (hasOverdueLoan) {
    //    borrowerStatus = "give_up";
     } else {
       borrowerStatus = "new";
     }

     // Prepare borrower data - convert numeric fields to strings
     const borrowerData = {
       atom_borrower_id: externalData.borrower_id.toString(),
       full_name: externalData.borrower_name,
       phone_number: externalData.phone_number,
       phone_number_2: externalData.phone_number,
       phone_number_3: externalData.phone_number,
       email: "",
       residential_status: "",
       status: borrowerStatus,
       source: borrowerSource,
       
       // AA Status - determine based on loan activity
       aa_status: hasActiveLoan ? "yes" : "no",
       id_type: convertIdType(externalData.id_type),
       id_number: "",
       
       // Employment & Income - convert to strings
       income_document_type: convertIncomeDocumentType(externalData.income_document_type),
       current_employer: externalData.current_employer_name,
       average_monthly_income: externalData.average_monthly_income.toString(),
       annual_income: externalData.annually_income.toString(),
       
       // Loan Information - Using primary loan for main borrower record
       estimated_reloan_amount: primaryLoan?.estimated_reloan_amount?.toString() ?? "",
       loan_id: primaryLoan?.loan_id?.toString() ?? "",
       latest_completed_loan_date: (() => {
         // Find latest completed loan date from parsed loans
         if (parsedLoans.length === 0) {
           return null;
         }
         
         const completedLoans = parsedLoans.filter(loan => loan.loan_completed_date && loan.loan_completed_date.trim() !== "");
         if (completedLoans.length === 0) {
           return null;
         }
         
         // Sort by completion date and get the latest one
         const latestLoan = completedLoans.sort((a, b) => {
           const dateA = new Date(a.loan_completed_date ?? 0);
           const dateB = new Date(b.loan_completed_date ?? 0);
           return dateB.getTime() - dateA.getTime();
         })[0];
         
         return latestLoan?.loan_completed_date ?? null;
       })(),
       
       // Customer Performance Buckets (from external API)
       is_in_closed_loan: externalData.is_in_closed_loan ?? "",
       is_in_2nd_reloan: externalData.is_in_2nd_reloan ?? "",
       is_in_attrition: externalData.is_in_attrition ?? "",
       is_in_last_payment_due: externalData.is_in_last_payment_due ?? "",
       is_in_bhv1: externalData.is_in_bhv1 ?? "",
       
       // Additional fields
       credit_score: "",
       loan_amount: primaryLoan?.estimated_reloan_amount?.toString() ?? "",
       loan_status: hasActiveLoan ? "active" : "completed",
       loan_notes: primaryLoan?.loan_comments?.join("; ") ?? "",
       lead_score: 0,
       financial_commitment_change: "not_applicable",
       contact_preference: "No Preferences",
       communication_language: "No Preferences",
       follow_up_date: null,
       
       updated_by: userId,
       updated_at: new Date(),
     };

    let result;
    let action = "";

    if (existingBorrower.length > 0) {
      // Update existing borrower
      result = await db
        .update(borrowers)
        .set(borrowerData)
        .where(eq(borrowers.id, existingBorrower[0]!.id))
        .returning();
      
      action = "updated";
      
      // Log the update
      await db.insert(borrower_actions).values({
        borrower_id: existingBorrower[0]!.id,
        user_id: userId,
        action_type: "note",
        content: `Synced from external API - ${parsedLoans.length} loans found`,
        timestamp: new Date(),
        created_by: userId,
      });

    } else {
      // Create new borrower
      result = await db
        .insert(borrowers)
        .values({
          ...borrowerData,
          created_by: userId,
          created_at: new Date(),
        })
        .returning();
      
      action = "created";
      
      // Log the creation
      if (result[0]) {
        await db.insert(borrower_actions).values({
          borrower_id: result[0].id,
          user_id: userId,
          action_type: "note",
          content: `Created from external API sync - ${parsedLoans.length} loans found`,
          timestamp: new Date(),
          created_by: userId,
        });
      }
    }

    const borrower = result[0];
    if (!borrower) {
      throw new Error("Failed to sync borrower");
    }
    
         // Sync loan plans
     if (parsedLoans.length > 0) {
       // Don't delete existing loan plans - instead update or create as needed
       
       for (const loan of parsedLoans) {
         // Check if loan plan already exists for this loan_id and borrower
         const existingLoanPlan = await db
           .select()
           .from(loan_plans)
           .where(
             and(
               eq(loan_plans.borrower_id, borrower.id),
               eq(loan_plans.loan_id, loan.loan_id.toString())
             )
           )
           .limit(1);

         // Mark the loan plan as selected if it matches the borrower's primary loan
         const isPrimaryLoan = primaryLoan && loan.loan_id === primaryLoan.loan_id;
         
         const loanPlanData = {
           loan_id: loan.loan_id.toString(),
           borrower_id: borrower.id,
           product_name: loan.product_name,
           estimated_reloan_amount: loan.estimated_reloan_amount.toString(),
           has_bd: loan.has_bd === "Yes",
           has_bhv: loan.has_bhv === "Yes", 
           has_dnc: loan.has_dnc === "Yes",
           is_overdue: loan.is_overdue === "Yes",
           next_due_date: loan.next_due_date ? new Date(loan.next_due_date) : null,
           loan_completed_date: loan.loan_completed_date ? new Date(loan.loan_completed_date) : null,
           loan_comments: Array.isArray(loan.loan_comments) ? loan.loan_comments.join("; ") : null,
           plan_details: loan,
           is_selected: isPrimaryLoan ?? false,
         };

         if (existingLoanPlan.length > 0) {
           // Update existing loan plan
           await db
             .update(loan_plans)
             .set({
               ...loanPlanData,
               updated_at: new Date(),
             })
             .where(eq(loan_plans.id, existingLoanPlan[0]!.id));
           
           console.log(`✅ Updated existing loan plan for loan_id: ${loan.loan_id}`);
         } else {
           // Create new loan plan
           await db.insert(loan_plans).values({
             ...loanPlanData,
             created_by: userId,
             created_at: new Date(),
           });
           
           console.log(`✅ Created new loan plan for loan_id: ${loan.loan_id}`);
         }
       }
     }

    return { success: true, action, borrower, loansCount: parsedLoans.length };

  } catch (error) {
    console.error("Error syncing borrower:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to sync borrower");
  }
}

// Sync all borrowers from external API
export async function syncAllBorrowers() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const { data: externalBorrowers } = await fetchExternalBorrowers();
    
    const results = {
      total: externalBorrowers.length,
      created: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{ borrower_id: string; action: string; error?: string }>
    };

    // Process each borrower
    for (const borrowerData of externalBorrowers) {
      try {
        console.log(borrowerData);
        const result = await syncBorrower(borrowerData);
        
        if (result.action === "created") {
          results.created++;
        } else {
          results.updated++;
        }
        
        results.details.push({
          borrower_id: borrowerData.borrower_id.toString(),
          action: result.action
        });
        
      } catch (error) {
        results.errors++;
        results.details.push({
          borrower_id: borrowerData.borrower_id.toString(),
          action: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Log the sync summary
    await db.insert(logs).values({
      description: `Synced ${results.total} borrowers: ${results.created} created, ${results.updated} updated, ${results.errors} errors`,
      entity_type: "borrower_sync",
      entity_id: "bulk_sync",
      action: "sync_all",
      performed_by: userId,
      timestamp: new Date(),
    });

    revalidatePath("/dashboard/borrowers");
    revalidatePath("/dashboard/borrowers/settings");

    return { success: true, results };

  } catch (error) {
    console.error("Error syncing all borrowers:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to sync borrowers");
  }
}

// Get loan plans for a borrower
export async function getBorrowerLoanPlans(borrowerId: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const plans = await db
      .select()
      .from(loan_plans)
      .where(eq(loan_plans.borrower_id, borrowerId))
      .orderBy(desc(loan_plans.is_selected), desc(loan_plans.created_at));

    return { success: true, data: plans };

  } catch (error) {
    console.error("Error fetching borrower loan plans:", error);
    throw new Error("Failed to fetch borrower loan plans");
  }
}

// Get borrower with loan plans
export async function getBorrowerWithLoanPlans(borrowerId: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Get borrower data
    const borrowerResult = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, borrowerId))
      .limit(1);

    if (borrowerResult.length === 0) {
      throw new Error("Borrower not found");
    }

    // Get loan plans
    const loanPlansResult = await db
      .select()
      .from(loan_plans)
      .where(eq(loan_plans.borrower_id, borrowerId))
      .orderBy(desc(loan_plans.is_selected), desc(loan_plans.created_at));

    return { 
      success: true, 
      data: {
        borrower: borrowerResult[0],
        loanPlans: loanPlansResult
      }
    };

  } catch (error) {
    console.error("Error fetching borrower with loan plans:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch borrower with loan plans");
  }
} 