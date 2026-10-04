import webpush from "npm:web-push@3.6.7"
import { createClient } from "npm:@supabase/supabase-js@2"

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

const FALLBACK_PUBLIC_KEYS = new Set(["sb_publishable_TKdXl9sJqOhmIhFIv5w6ug_RrF-rKPw","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb3VlcHJweWNpcWZycXNsdHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzcxNDcsImV4cCI6MjEwNDc1MzE0N30.8L_5BhX_3fqyyoTfGmlAoJaqiczOzjWkDBATqTR3sJs"])

function authorized(req: Request) {
  const key = req.headers.get("apikey") || ""
  if (FALLBACK_PUBLIC_KEYS.has(key)) return true
  if (key === (Deno.env.get("SUPABASE_ANON_KEY") || "")) return true
  try {
    const raw = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")
    return Object.values(raw).some((value) => value === key)
  } catch {
    return false
  }
}

async function getOrCreateVapid() {
  const { data: existing } = await db
    .from("quantix_notification_config")
    .select("public_key,private_key")
    .eq("id", 1)
    .maybeSingle()

  if (existing?.public_key && existing?.private_key) return existing

  const keys = webpush.generateVAPIDKeys()
  const { data, error } = await db
    .from("quantix_notification_config")
    .upsert({
      id: 1,
      public_key: keys.publicKey,
      private_key: keys.privateKey,
      updated_at: new Date().toISOString(),
    })
    .select("public_key,private_key")
    .single()

  if (error) throw error
  return data
}

Deno.serve(async (req: Request) => {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 })

  try {
    const input = await req.json().catch(() => ({}))

    if (input?.action === "init") {
      const config = await getOrCreateVapid()
      return Response.json({ ok: true, publicKey: config.public_key })
    }

    const notificationId = input?.notification_id
    if (!notificationId) return Response.json({ ok: false, skipped: true })

    const { data: notification, error: notificationError } = await db
      .from("quantix_notifications")
      .select("id,user_id,title,body,type")
      .eq("id", notificationId)
      .maybeSingle()

    if (notificationError) throw notificationError
    if (!notification) return Response.json({ ok: false, skipped: true })

    const config = await getOrCreateVapid()
    webpush.setVapidDetails(
      "mailto:notifications@quantixprime.online",
      config.public_key,
      config.private_key,
    )

    const { data: subscriptions, error: subscriptionError } = await db
      .from("quantix_notification_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", notification.user_id)

    if (subscriptionError) throw subscriptionError

    let sent = 0
    let removed = 0

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            notificationId: notification.id,
            url: "/qx7-ops-4m9k2",
            type: notification.type,
            important: true,
          }),
          {
            TTL: 86400,
            urgency: "high",
            topic: notification.type,
          },
        )

        sent++
        await db
          .from("quantix_notification_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", subscription.id)
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          await db
            .from("quantix_notification_subscriptions")
            .delete()
            .eq("id", subscription.id)
          removed++
        }
      }
    }

    await db
      .from("quantix_notifications")
      .update({ delivery_status: sent ? "PUSH_SENT" : "IN_APP" })
      .eq("id", notification.id)

    return Response.json({ ok: true, sent, removed })
  } catch (error) {
    console.error("Quantix push delivery failed", error)
    return Response.json({ ok: false, error: "Push delivery failed" }, { status: 500 })
  }
})
