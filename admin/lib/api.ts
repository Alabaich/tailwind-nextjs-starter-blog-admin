import { NextResponse } from 'next/server';
import { BodyError, jsonError } from './http';
import { ValidationError } from './posts';

/**
 * Maps errors to responses. Only messages we wrote ourselves reach the
 * client; anything unexpected (filesystem paths, stack details) is logged
 * server-side and replaced with a generic 500.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ValidationError) return jsonError(err.message, 400);
  if (err instanceof BodyError) return jsonError(err.message, err.status);
  console.error(err);
  return jsonError('Internal error', 500);
}

/** Posts are capped at 1 MB of body text; leave headroom for the other fields. */
export const MAX_POST_BYTES = 1_100_000;
