// frontend/src/features/landing/components/LandingPage.tsx
import { LandingNavbar } from './LandingNavbar'
import { LandingHero } from './LandingHero'
import { LandingOverview } from './LandingOverview'
import { LandingInventorySection } from './LandingInventorySection'
import { LandingAgentSection } from './LandingAgentSection'
import { LandingPricing } from './LandingPricing'
import { LandingFooter } from './LandingFooter'

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--lp-bg)', color: 'var(--lp-ink)', fontFamily: '"Inter", system-ui, sans-serif' }}>
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingOverview />
        <LandingInventorySection />
        <LandingAgentSection />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  )
}
