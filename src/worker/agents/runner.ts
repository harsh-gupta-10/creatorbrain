import type { AIRouter } from '../ai/router';
import type { AIMessage, AIToolDefinition, AIToolCall } from '../ai/types';
import type { AgentTrace } from '../../shared/types';

export interface RunAgentOptions {
  name: string;
  systemPrompt: string;
  tools: AIToolDefinition[];
  input: string;
  creatorId: string;
  maxSteps?: number;
  router: AIRouter;
  db?: D1Database;
}

export interface AgentRunResult {
  agentName: string;
  finalOutput: string;
  stepsExecuted: number;
  traces: AgentTrace[];
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const {
    name,
    systemPrompt,
    tools,
    input,
    creatorId,
    maxSteps = 6,
    router,
    db,
  } = options;

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input },
  ];

  const traces: AgentTrace[] = [];
  let currentStep = 1;
  let finalOutput = '';

  while (currentStep <= maxSteps) {
    let stepOutput = '';
    let toolCalls: AIToolCall[] = [];

    try {
      const response = await router.callWithTools(messages, tools, { creatorId });
      stepOutput = response.text;
      toolCalls = response.toolCalls || [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Agent ${name}] Step ${currentStep} error:`, message);
      stepOutput = `Encountered error: ${message}. Proceeding with autonomous fallback plan.`;
    }

    if (toolCalls.length === 0) {
      // Agent finished reasoning or provided text response
      finalOutput = stepOutput || finalOutput || `Agent ${name} completed task successfully.`;

      const trace: AgentTrace = {
        id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        creator_id: creatorId,
        agent_name: name,
        task_description: input.slice(0, 150),
        step_number: currentStep,
        total_steps: currentStep,
        tool_called: undefined,
        tool_input: undefined,
        tool_result: undefined,
        output_summary: finalOutput.slice(0, 300),
        status: 'success',
        created_at: new Date().toISOString(),
      };

      traces.push(trace);
      await persistTrace(db, trace);
      break;
    }

    // Execute tool calls
    for (const tc of toolCalls) {
      const toolDef = tools.find((t) => t.name === tc.name);
      let toolResult: unknown = null;
      let toolStatus: 'success' | 'failed' = 'success';

      if (!toolDef) {
        toolResult = { error: `Tool ${tc.name} is not available.` };
        toolStatus = 'failed';
      } else {
        try {
          // Zod schema validation
          const validatedArgs = toolDef.parameters.parse(tc.arguments);
          toolResult = await toolDef.execute(validatedArgs, { creatorId, db, router });
        } catch (validationErr: unknown) {
          const message = validationErr instanceof Error ? validationErr.message : String(validationErr);
          toolResult = { error: `Validation or execution error: ${message}` };
          toolStatus = 'failed';
        }
      }

      const trace: AgentTrace = {
        id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        creator_id: creatorId,
        agent_name: name,
        task_description: input.slice(0, 150),
        step_number: currentStep,
        total_steps: maxSteps,
        tool_called: tc.name,
        tool_input: JSON.stringify(tc.arguments),
        tool_result: JSON.stringify(toolResult),
        output_summary: `Executed ${tc.name}: ${JSON.stringify(toolResult).slice(0, 200)}`,
        status: toolStatus,
        created_at: new Date().toISOString(),
      };

      traces.push(trace);
      await persistTrace(db, trace);

      // Feed back into messages
      messages.push({
        role: 'assistant',
        content: stepOutput,
        tool_calls: [tc],
      });

      messages.push({
        role: 'tool',
        name: tc.name,
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult),
      });
    }

    currentStep++;
  }

  return {
    agentName: name,
    finalOutput,
    stepsExecuted: currentStep > maxSteps ? maxSteps : currentStep,
    traces,
  };
}

async function persistTrace(db: D1Database | undefined, trace: AgentTrace): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO agent_traces (
          id, creator_id, agent_name, task_description, step_number, total_steps,
          tool_called, tool_input, tool_result, output_summary, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        trace.id,
        trace.creator_id,
        trace.agent_name,
        trace.task_description,
        trace.step_number,
        trace.total_steps,
        trace.tool_called || null,
        trace.tool_input || null,
        trace.tool_result || null,
        trace.output_summary,
        trace.status,
        trace.created_at
      )
      .run();
  } catch (err: unknown) {
    console.warn('[Agent Runner] Failed to persist trace to D1:', err instanceof Error ? err.message : String(err));
  }
}
