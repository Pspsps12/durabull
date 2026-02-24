import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout route for connection-scoped pages within an organization.
 * All routes under /$orgSlug/c/:connectionId use this layout.
 */
export const Route = createFileRoute('/$orgSlug/c/$connectionId')({
  component: ConnectionLayout,
})

function ConnectionLayout() {
  // This is just a pass-through layout that renders child routes
  // The connectionId and orgSlug are available via Route.useParams() in child components
  return <Outlet />
}
