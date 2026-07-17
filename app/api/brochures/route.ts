import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/brochures — list all brochures
export async function GET() {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { data, error } = await sb
    .from('brochures')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ brochures: data })
}

// POST /api/brochures — upload a brochure (multipart/form-data)
export async function POST(req: NextRequest) {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const formData = await req.formData()
    const file        = formData.get('file')        as File   | null
    const name        = formData.get('name')        as string | null
    const projectName = formData.get('project_name') as string | null

    if (!file || !name) {
      return NextResponse.json({ error: 'file and name are required' }, { status: 400 })
    }

    const ext      = file.name.split('.').pop() ?? 'pdf'
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await sb.storage
      .from('brochures')
      .upload(safeName, buffer, { contentType: file.type, upsert: false })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 })

    const { data: { publicUrl } } = sb.storage.from('brochures').getPublicUrl(safeName)

    const { data, error } = await sb.from('brochures').insert({
      name,
      project_name: projectName || null,
      file_url:     publicUrl,
      file_name:    file.name,
      file_size:    file.size,
      file_type:    ext === 'pdf' ? 'pdf' : 'image',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ brochure: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 })
  }
}
