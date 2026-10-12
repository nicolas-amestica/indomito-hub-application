export interface MeetingHost {
  id: string;
  sk: string;
  name: string;
  description: string;
  color: string;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MeetingHostRequest = Pick<
  MeetingHost,
  'name' | 'description' | 'color' | 'active' | 'isDefault'
>;
