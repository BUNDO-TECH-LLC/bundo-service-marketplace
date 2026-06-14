import { BUNDO_SUPPORT_EMAIL } from '../constants/support';

export type HelpQuestion = [string, string];
export type HelpSection = { heading: string; questions: HelpQuestion[] };
export type HelpTopic = { id: string; icon: string; title: string; sections: HelpSection[] };

export const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    icon: '01',
    title: 'Getting started with Bundo',
    sections: [
      {
        heading: 'About Bundo',
        questions: [
          ['What is Bundo?', 'Bundo connects customers with approved local artisans for home and lifestyle services. Customers discover services, message artisans, request bookings, and leave reviews after completed jobs.'],
          ['Where does Bundo work?', 'Bundo is built for Nigeria. Start by selecting your state, then browse available offerings from approved artisans in that location.'],
        ],
      },
      {
        heading: 'Account setup',
        questions: [
          ['How do I create an account?', 'Use Login or Sign up in the top navigation, then choose client or artisan during signup.'],
          ['Can one account become an artisan?', 'Yes. Go to Settings → Become an artisan, confirm you want to offer services, then complete onboarding, KYC, and admin approval before listing services publicly.'],
        ],
      },
    ],
  },
  {
    id: 'customers',
    icon: '02',
    title: 'Booking services as a customer',
    sections: [
      {
        heading: 'Finding professionals',
        questions: [
          ['How do I find a service?', 'Select your state from the homepage dropdown, open the marketplace, then compare available offerings and approved artisan profiles.'],
          ['What should I check before booking?', 'Check the service price, artisan location, rating count, and profile details before you request a booking.'],
        ],
      },
      {
        heading: 'Bookings',
        questions: [
          ['How do I place a booking?', 'Sign in as a customer, open a service card, and select Book. Your booking request appears in My bookings.'],
          ['Can I chat before booking?', 'No. Messaging unlocks after you place a booking request. Use Open chat from My bookings or the Messages tab once your request is sent.'],
        ],
      },
    ],
  },
  {
    id: 'artisans',
    icon: '03',
    title: 'Working as an artisan',
    sections: [
      {
        heading: 'Profile setup',
        questions: [
          ['How do I become an artisan?', 'Choose artisan during signup, or as a client open Settings → Become an artisan, confirm, then complete profile setup and KYC.'],
          ['When will customers see my profile?', 'Your profile becomes publicly discoverable after KYC and admin approval. This helps keep the marketplace trustworthy.'],
        ],
      },
      {
        heading: 'Offerings',
        questions: [
          ['How do I list a service?', 'After KYC and approval, open your artisan workspace to choose a category, add service details, and publish your offering.'],
          ['Can customers message me?', 'Yes. Customer messages appear in your conversations, and you can reply back inside the thread.'],
        ],
      },
    ],
  },
  {
    id: 'trust',
    icon: '04',
    title: 'Trust, reviews, and safety',
    sections: [
      {
        heading: 'Reviews',
        questions: [
          ['Who can leave a review?', 'Only customers can review an artisan, and reviews are tied to completed bookings.'],
          ['Why do ratings matter?', 'Ratings help customers choose reliable artisans and help strong professionals build credibility.'],
        ],
      },
      {
        heading: 'Marketplace safety',
        questions: [
          ['How does Bundo protect users?', 'Bundo verifies artisans before public listing, keeps booking and payment records, and provides support when disputes or safety concerns arise.'],
          ['Can Bundo review my messages?', 'Our support team may review conversation history when handling a dispute, safety concern, or account issue. Support notes are never visible to the other party.'],
        ],
      },
    ],
  },
  {
    id: 'payments',
    icon: '05',
    title: 'Payments, held funds, and payouts',
    sections: [
      {
        heading: 'Customer payments',
        questions: [
          ['How does Bundo handle payment?', 'Customers pay through Paystack. Once the transaction is confirmed, Bundo marks the payment as held while the booking is still in progress.'],
          ['When does the artisan get paid?', 'Bundo releases payout after the service is marked complete and the booking has been confirmed. This protects customers until the job is done and reduces fraud or incomplete-service risk.'],
          ['Does Bundo store card details?', 'No. Card and payment authorization are handled by Paystack. Bundo stores payment references and booking-linked status updates.'],
        ],
      },
      {
        heading: 'Payouts',
        questions: [
          ['How does an artisan receive payout?', 'An artisan adds a verified Nigerian payout account in their workspace. Once a held payment is approved for release, Bundo sends the payout to that account.'],
          ['Why might payout be delayed?', 'Payout may be delayed if the booking is not completed, a dispute is open, the payout account is missing, or our team is still reviewing the case.'],
        ],
      },
    ],
  },
  {
    id: 'disputes',
    icon: '06',
    title: 'Disputes and refunds',
    sections: [
      {
        heading: 'Dispute flow',
        questions: [
          ['When should I raise a dispute?', 'Raise a dispute when payment has been secured but the service outcome is contested, incomplete, or materially different from what was agreed.'],
          ['Who can raise a dispute?', 'The booking owner and the assigned artisan can open a dispute on the booking while payment is still held.'],
        ],
      },
      {
        heading: 'Refund decisions',
        questions: [
          ['What outcomes are possible?', 'Bundo can release payout to the artisan, issue a full refund to the customer, or issue a partial refund depending on the review outcome.'],
          ['How are decisions recorded?', 'Dispute outcomes are saved to your booking and payment history so there is a clear record of what was decided.'],
        ],
      },
    ],
  },
  {
    id: 'cancellations',
    icon: '07',
    title: 'Cancellations and rescheduling',
    sections: [
      {
        heading: 'Before service starts',
        questions: [
          ['Can I cancel a booking?', 'Yes. Customers can cancel a booking while it is still requested or accepted.'],
          ['Can I reschedule a booking?', 'Yes. Customers and artisans can reschedule a requested or accepted booking. If the artisan has active availability slots, the new time must fit those availability windows.'],
        ],
      },
      {
        heading: 'Operational rules',
        questions: [
          ['What happens after completion?', 'Completed bookings are not meant to be casually rewritten. Changes after completion should go through support and dispute handling instead.'],
          ['Why are time windows checked?', 'Availability checks reduce missed appointments and help keep booking promises aligned with the artisan’s declared working hours.'],
        ],
      },
    ],
  },
  {
    id: 'artisan-standards',
    icon: '08',
    title: 'Artisan standards and KYC',
    sections: [
      {
        heading: 'Verification and trust',
        questions: [
          ['Why does Bundo ask for KYC?', 'KYC helps Bundo confirm artisan identity before listing services publicly and enabling payouts. It strengthens trust for customers and reduces fraud risk.'],
          ['What does an artisan submit?', 'You will submit your legal name, document type, document number, a photo of your identity document, an optional selfie, and your address for review.'],
        ],
      },
      {
        heading: 'Review outcomes',
        questions: [
          ['What KYC outcomes can happen?', 'A submission can be approved, rejected, or returned with changes requested. Artisans are notified in their workspace when the review result changes.'],
          ['Does KYC replace profile approval?', 'No. KYC supports the broader trust workflow. Admin verification and marketplace approval still matter for public discovery and payout readiness.'],
        ],
      },
    ],
  },
  {
    id: 'privacy',
    icon: '09',
    title: 'Privacy and platform rules',
    sections: [
      {
        heading: 'Data handling',
        questions: [
          ['What account data does Bundo keep?', 'Bundo stores the minimum account, booking, review, payout, and notification data needed to operate the marketplace and support users.'],
          ['Who can see private conversation details?', 'Customers and the assigned artisan can see their thread. Admins can inspect conversations for moderation, support, fraud prevention, and dispute handling.'],
        ],
      },
      {
        heading: 'Marketplace rules',
        questions: [
          ['Can Bundo restrict accounts?', 'Yes. Bundo may restrict accounts involved in abuse, fraud, repeated cancellations, impersonation, or policy violations.'],
          ['Why do platform rules matter?', 'A service marketplace depends on trust. Clear platform rules help protect customers, reliable artisans, and payment operations.'],
        ],
      },
    ],
  },
  {
    id: 'support',
    icon: '10',
    title: 'Support and account issues',
    sections: [
      {
        heading: 'Getting help',
        questions: [
          ['How do I contact Bundo support?', `Email ${BUNDO_SUPPORT_EMAIL} with your account email and a short description of the issue.`],
          ['What if something goes wrong?', 'Message the other party in your booking thread first so there is a clear record. If you still need help, contact Bundo support with your booking details.'],
          ['What if my account is restricted?', `Bundo may restrict accounts that violate marketplace rules. Contact ${BUNDO_SUPPORT_EMAIL} with your account email and a short explanation.`],
        ],
      },
    ],
  },
];