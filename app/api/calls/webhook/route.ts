import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import { createNotification } from '@/lib/notifications'

// Exotel POSTs form-encoded data after every call ends.
// No user session here — verified by leadId presence in query string.
export async function POST(req: NextRequest) {
  try {
    const leadId = req.nextUrl.searchParams.get('leadId')

    // Parse form-encoded body from Exotel
    const text = await req.text()
    const params = new URLSearchParams(text)

    const callSid      = params.get('CallSid')      ?? ''
    const callStatus   = params.get('CallStatus')   ?? ''
    const durationStr  = params.get('Duration')     ?? '0'
    const recordingUrl = params.get('RecordingUrl') ?? null

    const duration = parseInt(durationStr, 10)
    const mins     = Math.floor(duration / 60)
    const secs     = duration % 60

    const outcomeMap: Record<string, string> = {
      completed:   'Answered',
      'no-answer': 'No Answer',
      busy:        'Busy',
      failed:      'Failed',
      canceled:    'Cancelled',
    }
    const outcome = outcomeMap[callStatus] ?? callStatus

    if (leadId) {
      const noteBody = JSON.stringify({
        type:         'Call Made',
        outcome,
        duration,
        recordingUrl,
        callSid,
        notes:        `${outcome} · ${mins}m ${secs}s`,
        autoLogged:   true,
      })

      const noteRes = await gql<{ createNote: { id: string } }>(/* GraphQL */`
        mutation CreateNote($input: NoteCreateInput!) {
          createNote(data: $input) { id }
        }
      `, { input: { title: 'Call Made', body: noteBody } })

      if (noteRes.data?.createNote?.id) {
        await gql(/* GraphQL */`
          mutation CreateNoteTarget($input: NoteTargetCreateInput!) {
            createNoteTarget(data: $input) { id }
          }
        `, { input: { noteId: noteRes.data.createNote.id, personId: leadId } })

        // Notify agent if no-answer so they remember to call back
        if (outcome === 'No Answer') {
          await createNotification({
            type:  'follow_up_due',
            title: 'Call not answered — call back?',
            body:  `Your call wasn't answered. Schedule a follow-up.`,
            leadId,
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.error('[Exotel webhook]', err)
  }

  // Always return 200 to stop Exotel retrying
  return NextResponse.json({ ok: true })
}

// Exotel may also send GET for verification
export async function GET() {
  return NextResponse.json({ ok: true })
}
