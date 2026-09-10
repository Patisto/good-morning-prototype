import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { hydrateLocalData } from './stores/bootstrap'
import { useSyncStore } from './stores/sync'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
useSyncStore().startMonitoring()

// All operational screens read local data first. Network sync is intentionally
// separate, so opening the app never waits for the server.
hydrateLocalData()
  // IndexedDB can be unavailable in a private/restricted browser context.
  // Keep the shell usable; individual stores will remain empty rather than
  // falling back to a network request.
  .catch((error: unknown) => console.error('Could not open local database.', error))
  .finally(() => app.mount('#app'))
