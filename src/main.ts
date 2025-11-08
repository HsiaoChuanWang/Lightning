import '@/assets/styles/global.css'
import '@/assets/styles/typography.scss'
import '@/assets/styles/variables.scss'
import naive from 'naive-ui'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(naive)

app.mount('#app')
