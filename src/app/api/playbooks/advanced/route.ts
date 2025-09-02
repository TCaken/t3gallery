import { NextRequest, NextResponse } from "next/server";
import { createAndRegisterPlaybookWithFilters } from "~/app/_actions/playbookManagement";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      samespacePlaybookId,
      name,
      description,
      agentIds,
      filters,
      callScript,
      timesetId,
      teamId,
      autoSyncEnabled = true,
      syncFrequency = 'daily',
    } = body;

    // Validate required fields
    if (!samespacePlaybookId) {
      return NextResponse.json(
        { success: false, message: "Samespace Playbook ID is required" },
        { status: 400 }
      );
    }
    if (!name || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Name and at least one agent are required" },
        { status: 400 }
      );
    }

    // Get the current user ID (you'll need to implement authentication)
    // For now, we'll use the first agent as the creator
    const createdBy = agentIds[0];

    const result = await createAndRegisterPlaybookWithFilters({
      samespacePlaybookId,
      name,
      description,
      agentIds,
      filters: filters || {},
      callScript,
      timesetId,
      teamId,
      autoSyncEnabled,
      syncFrequency,
      createdBy,
    });

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error("Error creating advanced playbook:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create advanced playbook",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
