import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DiscoverTab } from './DiscoverTab'
import { LikedTab } from './LikedTab'

export function RecipesPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold mb-6">{t('recipes.title')}</h1>
      <Tabs defaultValue="discover">
        <TabsList className="mb-6">
          <TabsTrigger value="discover">{t('recipes.discoverTab')}</TabsTrigger>
          <TabsTrigger value="liked">{t('recipes.likedTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="discover">
          <DiscoverTab />
        </TabsContent>
        <TabsContent value="liked">
          <LikedTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
