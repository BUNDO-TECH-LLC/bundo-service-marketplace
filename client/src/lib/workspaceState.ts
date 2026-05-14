import type { View, WorkspaceSection } from '../appTypes';

export function resetWorkspaceState() {
  return {
    view: 'home' as View,
    workspaceSection: 'overview' as WorkspaceSection,
  };
}
