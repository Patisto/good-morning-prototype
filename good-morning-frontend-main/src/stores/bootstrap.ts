import { useExpensesStore } from './expenses'
import { useGroceryStore } from './grocery'
import { useHostelStore } from './hostel'
import { useRestaurantStore } from './restaurant'
import { useSyncStore } from './sync'

/** Hydrate every operational store before the application is shown. */
export async function hydrateLocalData() {
  await Promise.all([
    useHostelStore().hydrate(),
    useRestaurantStore().hydrate(),
    useGroceryStore().hydrate(),
    useExpensesStore().hydrate(),
  ])
  await useSyncStore().refreshPendingCount()
}
