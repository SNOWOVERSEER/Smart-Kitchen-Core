import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'react-hot-toast'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px', borderRadius: '12px', marginBottom: '72px' },
        }}
      />
    </>
  ),
})
