export type LocationKind = 'country' | 'state' | 'area';

export type LocationListItem = {
  id: string;
  label: string;
  kind: LocationKind;
  parentId: string | null;
  state?: string;
  area?: string;
  count: number;
  hasChildren: boolean;
};
