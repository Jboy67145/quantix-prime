'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, ShieldCheck } from 'lucide-react'
import { getAdminNotificationSettings, getAdminPushPublicKey, removeNotificationSubscription, saveAdminNotificationSettings, saveNotificationSubscription } from '@/app/actions/notifications'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export default function AdminNotificationSettings() {
  const [withdrawal, setWithdrawal] = useState(true)
  const [deposit, setDeposit] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void getAdminNotificationSettings().then((s) => {
      setWithdrawal(Boolean(s.withdrawal_enabled))
      setDeposit(Boolean(s.deposit_enabled))
    }).catch(() => {})
    if ('Notification' in window && Notification.permission === 'granted') setPushEnabled(true)
  }, [])

  async function saveChannels(nextWithdrawal = withdrawal, nextDeposit = deposit) {
    setBusy(true); setMessage('')
    try {
      await saveAdminNotificationSettings({ withdrawalEnabled: nextWithdrawal, depositEnabled: nextDeposit })
      setMessage('Notification preferences saved.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save notification preferences.')
    } finally { setBusy(false) }
  }

  async function enablePush() {
    setBusy(true); setMessage('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('This browser does not support phone push notifications.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Notification permission was not granted. Enable notifications for Quantix Prime in Android settings and try again.')
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const publicKey = await getAdminPushPublicKey()
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('The phone did not return a complete push subscription.')
      await saveNotificationSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
      setPushEnabled(true)
      setMessage('Important phone notifications are enabled.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to enable phone notifications.')
    } finally { setBusy(false) }
  }

  async function disablePush() {
    setBusy(true); setMessage('')
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await removeNotificationSubscription(endpoint)
      }
      setPushEnabled(false)
      setMessage('Phone push notifications are disabled.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to disable phone notifications.')
    } finally { setBusy(false) }
  }

  return <div className="admin-notification-settings">
    <div className="admin-notification-hero">
      <div className="admin-notification-icon"><Bell size={20}/></div>
      <div>
        <h3>Admin phone notifications</h3>
        <p>Receive urgent approval alerts even when the Control Center is closed. Android lock-screen visibility still depends on the phone's notification and Do Not Disturb settings.</p>
      </div>
    </div>
    <div className="admin-notification-options">
      <label className="admin-notification-option">
        <span><strong>Withdrawal alerts</strong><small>Notify me whenever a user submits a withdrawal that needs approval.</small></span>
        <input type="checkbox" checked={withdrawal} disabled={busy} onChange={e=>{setWithdrawal(e.target.checked);void saveChannels(e.target.checked,deposit)}}/>
      </label>
      <label className="admin-notification-option">
        <span><strong>Deposit alerts</strong><small>Notify me whenever a user submits a deposit that needs approval.</small></span>
        <input type="checkbox" checked={deposit} disabled={busy} onChange={e=>{setDeposit(e.target.checked);void saveChannels(withdrawal,e.target.checked)}}/>
      </label>
    </div>
    <div className="admin-notification-push">
      <div><strong>{pushEnabled ? 'Phone push is active' : 'Phone push is not active'}</strong><span>Push delivery is designed for the phone even when the admin page is closed.</span></div>
      {pushEnabled
        ? <button type="button" className="secondary-button" disabled={busy} onClick={disablePush}><BellOff size={15}/> Disable phone push</button>
        : <button type="button" className="primary-button" disabled={busy} onClick={enablePush}><Bell size={15}/> Enable phone push</button>}
    </div>
    {message && <p className="admin-notification-status" role="status"><ShieldCheck size={15}/>{message}</p>}
  </div>
}
