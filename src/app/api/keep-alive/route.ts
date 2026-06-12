import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const supabase = createServiceClient()
  await supabase.from('projects').select('id').limit(1)
  return Response.json({ ok: true, timestamp: new Date().toISOString() })
}
