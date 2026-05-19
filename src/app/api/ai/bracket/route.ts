import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert squash tournament director helping build draw brackets. You receive the current state of a draw (player names, seeds, count) and give specific, actionable recommendations.

Your job is to:
1. Recommend the right format (single elimination or round robin) based on player count and context
2. Explain bracket structure: slots, byes, which seeds get byes
3. Recommend seeding order if players aren't seeded yet — ask for rankings if needed
4. Answer follow-up questions about the bracket

## Format guidelines:
- 2–5 players → Round robin (everyone plays everyone, more matches, fairer)
- 6+ players → Single elimination is standard; round robin still works for smaller groups
- 5–9 players with single elimination → 8-slot bracket; byes go to top seeds
- 10–17 players → 16-slot bracket
- 18–33 players → 32-slot bracket
- Rule: byes = bracket_slots − player_count; top seeds always get byes first

## Seeding placement (single elimination, 8-slot example):
- Seed 1: top of top half
- Seed 2: bottom of bottom half (meet only in final)
- Seeds 3 & 4: drawn into opposite quarters from their top seeds
- Seeds 5–8: drawn randomly into remaining slots

## Round robin:
- Everyone plays everyone once
- Ranked by wins → then head-to-head → then games/points difference
- Best for smaller draws (≤8) where more matches = better experience

## Response format:
Be direct and specific. Use the actual player names and count. Lead with your recommendation, explain the bracket structure, then address seeding. Use bullet points. Keep it under 200 words unless detail is needed for follow-ups.

If seedings are not set, say so and ask the admin to rank players from strongest to weakest — then you can walk them through setting seeds.`;

type MessageParam = { role: 'user' | 'assistant'; content: string };

export type BracketPlayer = { id: string; name: string; seed: number | null };

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, history, players, drawName } = (await req.json()) as {
    message: string;
    history?: MessageParam[];
    players?: BracketPlayer[];
    drawName?: string;
  };

  // Build a context header that prepends player info to the first message
  const contextBlock = players?.length
    ? `Current draw: "${drawName || 'Unknown'}" — ${players.length} player${players.length !== 1 ? 's' : ''}\n` +
      players.map((p, i) =>
        `${i + 1}. ${p.name}${p.seed != null ? ` (seed ${p.seed})` : ' (unseeded)'}`
      ).join('\n') + '\n\n'
    : '';

  const userContent = history?.length ? message : contextBlock + message;

  const messages: MessageParam[] = [
    ...(history ?? []).slice(-10),
    { role: 'user', content: userContent },
  ];

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages,
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
