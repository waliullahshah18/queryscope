import { NextResponse } from 'next/server'
import { handleDiscoverRequest } from '../../../src/server/discovery-service.js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const result = await handleDiscoverRequest(payload)
  return NextResponse.json(result.body, { status: result.status })
}
