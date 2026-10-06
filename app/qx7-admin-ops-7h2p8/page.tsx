import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/auth'
import ControlCenter from '@/app/admin/control-center'

export const metadata = {
  title: 'Quantix Prime Operations',
  robots: { index: false, follow: false },
}

export default async function OperationsAdminPage() {
  let profile
  try {
    profile = (await requireAdminUser()).profile
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/sign-in?next=/qx7-admin-ops-7h2p8')
    }
    redirect('/')
  }

  if (String(profile.role || '').toUpperCase() === 'SUPER_ADMIN') {
    redirect('/qx7-ops-4m9k2')
  }

  return <ControlCenter mode="operations" />
}
