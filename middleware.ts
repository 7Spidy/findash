import { NextResponse } from 'next/server'

// No auth — all routes are public. Session data lives in React state only.
export function middleware() {
  return NextResponse.next()
}
