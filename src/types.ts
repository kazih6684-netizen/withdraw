export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'leader' | 'trainer' | null;
  createdAt: any;
}

export interface TeamMember {
  id: string;
  name: string;
  number?: string;
  role: 'leader' | 'trainer';
  addedAt: any;
}

export interface RequestData {
  id: string;
  senderId: string;
  senderName: string;
  senderNumber?: string;
  senderRole: string;
  recipientName: string;
  recipientNumber?: string;
  amount: number;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  updatedAt?: any;
}
