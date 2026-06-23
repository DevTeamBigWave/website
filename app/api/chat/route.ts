import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '@/lib/chat-system-prompt';
import { TOOLS, runTool } from '@/lib/chat-tools';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 5;

let _anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

type WireMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(request: Request) {
  let body: { messages?: WireMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const wireMessages = Array.isArray(body.messages) ? body.messages : [];
  if (
    wireMessages.length === 0 ||
    wireMessages[wireMessages.length - 1].role !== 'user'
  ) {
    return new Response(
      JSON.stringify({ error: 'messages must end with a user turn' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const messages: Anthropic.MessageParam[] = wireMessages
    .filter((m) => m.content.trim().length > 0)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  const baseUrl = new URL(request.url).origin;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; [key: string]: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        let toolTurns = 0;
        while (toolTurns <= MAX_TOOL_TURNS) {
          const stream = client().messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: 'disabled' },
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          });

          stream.on('text', (delta) => {
            send({ type: 'text', text: delta });
          });

          const finalMessage = await stream.finalMessage();
          messages.push({ role: 'assistant', content: finalMessage.content });

          if (finalMessage.stop_reason !== 'tool_use') {
            break;
          }

          const toolUses = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tool of toolUses) {
            send({ type: 'status', status: `Checking ${tool.name}...` });
            const result = await runTool(
              tool.name,
              tool.input as Record<string, unknown>,
              baseUrl,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: result,
            });
          }

          messages.push({ role: 'user', content: toolResults });
          toolTurns += 1;
        }

        send({ type: 'done' });
      } catch (err: unknown) {
        const message =
          err instanceof Anthropic.RateLimitError
            ? 'Too many requests — please wait a moment and try again.'
            : err instanceof Anthropic.AuthenticationError
              ? 'Chat is misconfigured (auth). Please email info@wonderlandplayhouse.com.'
              : err instanceof Anthropic.APIError
                ? `Chat error (${err.status}). Try again, or email info@wonderlandplayhouse.com.`
                : 'Something went wrong. Email info@wonderlandplayhouse.com or call (718) 889-1777.';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
