'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from "~/server/db";
import { appointmentReminderLog } from "~/server/db/schema";
import { eq, desc, gte, lte, and, sql, count } from 'drizzle-orm';

/**
 * Get appointment reminder logs with optional filters
 */
export async function getAppointmentReminderLogs(options: {
  phoneNumber?: string;
  app?: string;
  status?: 'pending' | 'sent' | 'failed';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const { phoneNumber, app, status, startDate, endDate, limit = 50 } = options;

    // Build where conditions
    const conditions = [];
    
    if (phoneNumber) {
      conditions.push(eq(appointmentReminderLog.phone_number, phoneNumber));
    }
    
    if (app) {
      conditions.push(eq(appointmentReminderLog.app, app));
    }
    
    if (status) {
      conditions.push(eq(appointmentReminderLog.status, status));
    }
    
    if (startDate) {
      conditions.push(gte(appointmentReminderLog.sent_at, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(appointmentReminderLog.sent_at, endDate));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db.select()
      .from(appointmentReminderLog)
      .where(whereCondition)
      .orderBy(desc(appointmentReminderLog.sent_at))
      .limit(limit);

    return {
      success: true,
      logs,
      count: logs.length
    };

  } catch (error) {
    console.error('Error fetching appointment reminder logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get appointment reminder statistics
 */
export async function getAppointmentReminderStats(options: {
  startDate?: Date;
  endDate?: Date;
} = {}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const { startDate, endDate } = options;

    // Build where conditions for date range
    const conditions = [];
    if (startDate) {
      conditions.push(gte(appointmentReminderLog.sent_at, startDate));
    }
    if (endDate) {
      conditions.push(lte(appointmentReminderLog.sent_at, endDate));
    }
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get overall stats
    const totalCount = await db.select({ count: count() })
      .from(appointmentReminderLog)
      .where(whereCondition);

    const sentCount = await db.select({ count: count() })
      .from(appointmentReminderLog)
      .where(whereCondition ? and(whereCondition, eq(appointmentReminderLog.status, 'sent')) : eq(appointmentReminderLog.status, 'sent'));

    const failedCount = await db.select({ count: count() })
      .from(appointmentReminderLog)
      .where(whereCondition ? and(whereCondition, eq(appointmentReminderLog.status, 'failed')) : eq(appointmentReminderLog.status, 'failed'));

    // Get stats by app
    const statsByApp = await db.select({
      app: appointmentReminderLog.app,
      count: count(),
    })
      .from(appointmentReminderLog)
      .where(whereCondition)
      .groupBy(appointmentReminderLog.app)
      .orderBy(desc(count()));

    // Get stats by status
    const statsByStatus = await db.select({
      status: appointmentReminderLog.status,
      count: count(),
    })
      .from(appointmentReminderLog)
      .where(whereCondition)
      .groupBy(appointmentReminderLog.status)
      .orderBy(desc(count()));

    return {
      success: true,
      stats: {
        total: totalCount[0]?.count ?? 0,
        sent: sentCount[0]?.count ?? 0,
        failed: failedCount[0]?.count ?? 0,
        pending: (totalCount[0]?.count ?? 0) - (sentCount[0]?.count ?? 0) - (failedCount[0]?.count ?? 0),
        byApp: statsByApp,
        byStatus: statsByStatus,
        successRate: totalCount[0]?.count ? ((sentCount[0]?.count ?? 0) / totalCount[0].count * 100).toFixed(2) : '0'
      }
    };

  } catch (error) {
    console.error('Error fetching appointment reminder stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get recent failed appointment reminders for debugging
 */
export async function getRecentFailedReminders(limit = 10) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const failedReminders = await db.select()
      .from(appointmentReminderLog)
      .where(eq(appointmentReminderLog.status, 'failed'))
      .orderBy(desc(appointmentReminderLog.sent_at))
      .limit(limit);

    return {
      success: true,
      failedReminders,
      count: failedReminders.length
    };

  } catch (error) {
    console.error('Error fetching failed reminders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get appointment reminders for a specific customer
 */
export async function getCustomerReminderHistory(phoneNumber: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const reminders = await db.select()
      .from(appointmentReminderLog)
      .where(eq(appointmentReminderLog.phone_number, phoneNumber))
      .orderBy(desc(appointmentReminderLog.sent_at));

    return {
      success: true,
      reminders,
      count: reminders.length
    };

  } catch (error) {
    console.error('Error fetching customer reminder history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 