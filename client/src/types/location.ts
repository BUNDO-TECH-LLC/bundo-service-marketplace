export type LocationKind = 'country' | 'state' | 'area';

export type LocationListItem = {
  id: string;
  label: string;
  kind: LocationKind;
  parentId: string | null;
  state?: string;
  area?: string;
  lat: number;
  lng: number;
  count: number;
  hasChildren: boolean;
};
