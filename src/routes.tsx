import type { RouteObject } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import TopicPage from './pages/TopicPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: ':slug', element: <TopicPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
