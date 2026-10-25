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
  type: 'withdraw' | 'seat_booking' | 'sure_shot';
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
  studentId?: string;
  status: 'pending' | 'accepted' | 'confirmed' | 'rejected' | 'expired';
  createdAt: any;
  updatedAt?: any;
  expiresAt?: any;
  bookingSequence?: number;
  submittedByUid?: string;
  counselorLeader?: string;
}

export interface FakeInvoice1Data {
  candidateName: string;
  candidateNumber: string;
  counselorName: string;
  bookingNo: string;
  refId: string;
  paymentMethod: string;
  senderNumber: string;
  trxId: string;
  amount: string; // If empty string, amount is omitted!
  meetingCode: string;
  date: string;
}

export interface FakeInvoice2Data {
  candidateName: string;
  candidateNumber: string;
  counselorName: string;
  seatBookingId: string;
  bookingNo: string;
  date: string;
}

