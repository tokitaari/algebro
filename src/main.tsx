import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'
// KaTeX styles and fonts are bundled by Vite and served with the app.
import 'katex/dist/katex.min.css'
import './index.css'
import { initTheme } from './theme/theme'

// The inline script in index.html has set the theme before the first paint; this syncs the app state with it.
initTheme()

// BASE_URL is provided by Vite (e.g. "/lemmio/" on GitHub Pages).
const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
