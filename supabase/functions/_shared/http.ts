import { corsHeaders } from './cors.ts';

export type JsonRecord = Record<string, unknown>;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(req: Request): Promise<JsonRecord> {
  return await req.json().catch(() => ({})) as JsonRecord;
}

export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function parsePositiveInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function clampText(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}
