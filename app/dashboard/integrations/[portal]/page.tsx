import SettingsShell from '@/components/settings/SettingsShell'

export default async function PortalPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params
  return <SettingsShell section="portals" portal={portal} />
}
