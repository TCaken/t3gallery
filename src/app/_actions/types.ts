// Types for orchestrated operations
export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface OrchestrationResult {
  success: boolean;
  message?: string;
  error?: string;
  results: Array<{
    action: string;
    success: boolean;
    result?: ActionResult;
  }>;
  rollbackAttempted?: boolean;
}

// Transaction coordinator - manages atomicity across multiple actions
export class TransactionCoordinator {
  private completedActions: Array<{
    action: string;
    success: boolean;
    result?: ActionResult;
    rollbackFunction?: () => Promise<void>;
  }> = [];

  // Execute a series of actions with coordination
  async execute(actions: Array<() => Promise<ActionResult>>, actionNames: string[]): Promise<OrchestrationResult> {
    try {
      // Execute each action in sequence
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]!;
        const actionName = actionNames[i]!;
        
        console.log(`Executing action: ${actionName}`);
        
        const result = await action();
        
        this.completedActions.push({
          action: actionName,
          success: result.success,
          result
        });
        
        if (!result.success) {
          console.error(`Action ${actionName} failed:`, result.error);
          
          // Attempt rollback of completed actions
          await this.rollback();
          
          return {
            success: false,
            error: result.error ?? `Failed to execute ${actionName}`,
            results: this.completedActions,
            rollbackAttempted: true
          };
        }
        
        console.log(`Action ${actionName} completed successfully`);
      }
      
      return {
        success: true,
        message: `Successfully executed ${actions.length} actions`,
        results: this.completedActions
      };
      
    } catch (error) {
      console.error('Transaction coordination failed:', error);
      
      await this.rollback();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown coordination error',
        results: this.completedActions,
        rollbackAttempted: true
      };
    }
  }

  // Attempt to rollback completed actions (limited rollback capability)
  private async rollback() {
    console.log('Attempting rollback of completed actions...');
    
    // For now, we can only log rollback attempts
    // Full rollback would require storing previous state or implementing compensating actions
    for (const completed of this.completedActions.reverse()) {
      if (completed.rollbackFunction) {
        try {
          await completed.rollbackFunction();
          console.log(`Rolled back: ${completed.action}`);
        } catch (error) {
          console.error(`Failed to rollback ${completed.action}:`, error);
        }
      } else {
        console.log(`No rollback function for: ${completed.action}`);
      }
    }
  }
} 