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
  pin?: string;
  avatar?: string;
  gender?: 'male' | 'female';
  addedAt: any;
}

export interface RequestData {
  id: string;
  refId?: string;
  type: 'withdraw' | 'seat_booking';
  senderId: string;
  senderName: string;
  senderNumber?: string;
  senderRole: string;
  recipientName: string;
  recipientNumber?: string;
  amount: number;
  trxDigit?: string;
  whatsappNumber?: string;
  paymentMethod?: 'BKASH' | 'NAGAD' | 'ROCKET' | 'CASH';
  note?: string;
  status: 'pending' | 'accepted' | 'confirmed' | 'rejected';
  createdAt: any;
  updatedAt?: any;
}

