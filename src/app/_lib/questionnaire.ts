import { type InferSelectModel } from 'drizzle-orm';
import { type leads } from "~/server/db/schema";

type Lead = InferSelectModel<typeof leads>;

// Define field types with proper typing
interface BaseField {
  name: keyof Lead | 'lead_notes';
  label: string;
  type: string;
  disabled?: boolean;
  showIf?: (values: Partial<Lead>) => boolean;
  note?: string | ((values: Partial<Lead>) => string);
}

interface TextField extends BaseField {
  type: 'text' | 'tel' | 'textarea';
}

interface SelectField extends BaseField {
  type: 'select';
  options: string[];
}

interface CheckboxField extends BaseField {
  type: 'checkbox';
}

interface RadioField extends BaseField {
  type: 'radio';
  options: string[];
}

interface CheckboxGroupField extends BaseField {
  type: 'checkbox-group';
  options: string[];
}

export type Field = TextField | SelectField | CheckboxField | RadioField | CheckboxGroupField;

export interface Section {
  title: string;
  fields: Field[];
  icon?: React.ComponentType<{ className?: string }>;
}

// Define questionnaire sections with proper typing
export const createQuestionnaireSections = (isQuestionnaireMode: boolean): Section[] => [
  {
    title: isQuestionnaireMode ? "Let's start with some basic information" : "Personal Information",
    fields: [
      { name: "source", label: isQuestionnaireMode ? "How did you hear about us?" : "Lead Source", type: "text", disabled: true } as TextField,
      { name: "created_at", label: isQuestionnaireMode ? "When did you first contact us?" : "Lead Date", type: "text", disabled: true } as TextField,
      { name: "full_name", label: isQuestionnaireMode ? "What is your full name?" : "Full Name", type: "text" } as TextField,
      { name: "email", label: isQuestionnaireMode ? "What is your email address?" : "Email", type: "text" } as TextField,
      { name: "phone_number", label: isQuestionnaireMode ? "What is your primary contact number?" : "Primary Phone", type: "tel", disabled: true } as TextField,
      { name: "phone_number_2", label: isQuestionnaireMode ? "Do you have an alternative contact number?" : "Secondary Phone", type: "tel" } as TextField,
      { name: "phone_number_3", label: isQuestionnaireMode ? "Any other contact number we should know about?" : "Additional Phone", type: "tel" } as TextField,
    ]
  },
  {
    title: isQuestionnaireMode ? "Tell us about your residency status" : "Residential Status",
    fields: [
      { 
        name: "residential_status", 
        label: "Are you a local or foreigner?", 
        type: "radio",
        options: ["Local", "Foreigner"],
        note: "Please select your residency status"
      } as RadioField,
      { 
        name: "has_work_pass_expiry", 
        label: isQuestionnaireMode 
          ? "When does your work pass expire?" 
          : "When does your work pass expire?", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "⚠️ Must have at least 6 months validity from today"
      } as TextField,
      { 
        name: "proof_of_residence_type", 
        label: isQuestionnaireMode 
          ? "What proof of residence documents can you provide?" 
          : "Proof of Residence Documents", 
        type: "checkbox-group",
        options: ["Bank Statement", "Utility Bill", "Handphone Bill"],
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "📄 Select all documents you can provide:\n\n⚠️ Important: Must provide either current month or last month statement"
      } as CheckboxGroupField,
      { 
        name: "has_letter_of_consent", 
        label: isQuestionnaireMode 
          ? "Do you have a letter of consent from ICA?" 
          : "Has Letter of Consent", 
        type: "checkbox",
        showIf: (values: Partial<Lead>) => values.residential_status === "Foreigner",
        note: "📝 Required for LTVP and LTVP+ pass holders only"
      } as CheckboxField
    ]
  },
  {
    title: isQuestionnaireMode ? "Let's discuss your employment" : "Employment Details",
    fields: [
      { 
        name: "employment_status", 
        label: isQuestionnaireMode ? "What is your current employment situation?" : "Employment Status", 
        type: "select",
        options: ["Full-Time", "Part-Time", "Self-Employed", "Self-Employed (Platform Worker)", "Unemployed", "UNKNOWN"]
      },
      { 
        name: "employment_salary", 
        label: isQuestionnaireMode ? "What is your monthly income?" : "Monthly Income", 
        type: "text"
      },
      { 
        name: "employment_length", 
        label: isQuestionnaireMode ? "How long have you been employed?" : "Length of Employment", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.employment_status !== "Unemployed"
      },
      {
        name: "has_payslip_3months",
        label: isQuestionnaireMode 
          ? "Do you have the latest 3 months payslips from your employer?" 
          : "Has Latest 3 Months Payslips",
        type: "checkbox",
        showIf: (values: Partial<Lead>) => {
          const salary = parseFloat(values.employment_salary?.toString() ?? '0');
          return (
            values.residential_status === "Foreigner" ||
            (values.residential_status === "Local" && (
              (values.employment_status === "Full-Time" && salary >= 7400) ||
              values.employment_status === "Self-Employed" ||
              values.employment_status === "Self-Employed (Platform Worker)"
            ))
          );
        },
        note: (values: Partial<Lead>) => {
          const salary = parseFloat(values.employment_salary?.toString() ?? '0');
          const isHighIncome = values.employment_status === "Full-Time" && salary >= 7400;
          const isSelfEmployed = values.employment_status === "Self-Employed" || values.employment_status === "Self-Employed (Platform Worker)";
          
          let note = "📄 Requirements:\n• Must be latest 3 months\n• No payment vouchers\n• No handwritten payslips\n\n⚠️ From 6th of the month onwards, must include last month's payslip";
          
          if (values.residential_status === "Local") {
            if (isHighIncome) {
              note += "\n💡 Required for high-income verification (>= $7,400)";
            } else if (isSelfEmployed) {
              note += "\n💡 Required for Self-Employed and Platform Workers income verification";
            }
          }
          
          return note;
        }
      } as CheckboxField
    ] as Field[]
  },
  {
    title: isQuestionnaireMode ? "Tell us about your loan requirements" : "Loan Information",
    fields: [
      { 
        name: "amount", 
        label: isQuestionnaireMode ? "How much would you like to borrow?" : "Requested Loan Amount", 
        type: "text" 
      },
      { 
        name: "loan_purpose", 
        label: isQuestionnaireMode ? "What do you need the loan for?" : "Purpose of Loan", 
        type: "text" 
      },
      { 
        name: "existing_loans", 
        label: isQuestionnaireMode ? "Do you have any existing loans?" : "Has Existing Loans", 
        type: "select", 
        options: ["Yes", "No", "UNKNOWN"] 
      },
      { 
        name: "outstanding_loan_amount", 
        label: isQuestionnaireMode ? "What is the total amount of your existing loans?" : "Outstanding Loan Amount", 
        type: "text",
        showIf: (values: Partial<Lead>) => values.existing_loans === "Yes"
      }
    ] as Field[]
  },
  {
    title: isQuestionnaireMode ? "How would you like us to contact you?" : "Communication Preferences",
    fields: [
      { 
        name: "contact_preference", 
        label: isQuestionnaireMode ? "What's your preferred way of communication?" : "Preferred Contact Method", 
        type: "select",
        options: ["No Preferences", "WhatsApp", "Call", "SMS", "Email"]
      },
      { 
        name: "communication_language", 
        label: isQuestionnaireMode ? "Which language would you prefer?" : "Preferred Language", 
        type: "select",
        options: ["No Preferences", "English", "Mandarin", "Malay", "Tamil", "Others"]
      },
      { 
        name: "lead_notes", 
        label: isQuestionnaireMode ? "Is there anything else you'd like us to know about your application?" : "Lead Notes", 
        type: "textarea",
        note: isQuestionnaireMode 
          ? "Please share any additional details that might help us process your loan application better."
          : "Add any internal notes about this lead, follow-up requirements, or important details."
      } as TextField
    ] as Field[]
  }
]; 