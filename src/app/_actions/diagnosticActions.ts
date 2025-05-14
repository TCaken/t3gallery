'use server';

import { db } from "~/server/db";
import { sql } from "drizzle-orm";

interface TableInfo {
  table_name: string;
}

interface DiagnosticResult {
  allTables: TableInfo[];
  leadsTable: TableInfo[];
  error: string | null;
}

interface SafeEnvVars {
  NODE_ENV: string;
  DATABASE_URL: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  DATABASE_HOST: string;
  DATABASE_NAME: string;
}

/**
 * Get diagnostic information about the database
 */
export async function getDatabaseDiagnostics(): Promise<DiagnosticResult> {
  try {
    // Get all tables in the database
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Look specifically for the leads table with any prefix/suffix
    const leadsTableResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%leads%'
    `);
    
    // Extract results (handle both Postgres and MySQL response formats)
    const allTables = Array.isArray(tablesResult.rows) 
      ? tablesResult.rows.map(row => ({ table_name: row.table_name as string }))
      : [];
    
    const leadsTable = Array.isArray(leadsTableResult.rows)
      ? leadsTableResult.rows.map(row => ({ table_name: row.table_name as string }))
      : [];
    
    return {
      allTables,
      leadsTable,
      error: null
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Diagnostic error:", errorMessage);
    return {
      allTables: [],
      leadsTable: [],
      error: errorMessage
    };
  }
}

/**
 * Get safe environment variables (with sensitive info redacted)
 */
export async function getSafeEnvVars(): Promise<SafeEnvVars> {
  return {
    NODE_ENV: process.env.NODE_ENV ?? "Not set",
    DATABASE_URL: process.env.DATABASE_URL ? 
      `${process.env.DATABASE_URL.split("://")[0]}://*****@*****` : 
      "Not set",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 
      `Set (begins with ${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 5)}...)` : 
      "Not set",
    DATABASE_HOST: process.env.DATABASE_HOST ?? "Not set",
    DATABASE_NAME: process.env.DATABASE_NAME ?? "Not set",
  };
} 