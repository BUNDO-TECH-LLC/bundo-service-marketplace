import { BUNDO_SUPPORT_EMAIL } from '../constants/support';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  summary:
    'These terms govern your use of the Bundo marketplace, including bookings, payments, messaging, and artisan services.',
  lastUpdated: '19 May 2026',
  sections: [
    {
      heading: '1. Agreement',
      paragraphs: [
        'By creating a Bundo account or using our website and services, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use Bundo.',
        'Bundo is operated by Bundo Tech LLC (“Bundo”, “we”, “us”). We may update these terms from time to time; continued use after changes means you accept the updated terms.',
      ],
    },
    {
      heading: '2. The marketplace',
      paragraphs: [
        'Bundo connects customers who need home and personal services with independent artisans who offer those services. Bundo provides the platform, booking tools, messaging, and payment facilitation — we are not the employer of artisans and do not perform the services booked through the platform.',
        'Artisans are responsible for the quality, safety, and legality of the services they provide. Customers are responsible for providing accurate booking details and treating artisans respectfully.',
      ],
    },
    {
      heading: '3. Accounts and eligibility',
      paragraphs: [
        'You must provide accurate information, keep your login credentials secure, and choose the correct account type (client or artisan) during signup.',
        'Artisan accounts require profile setup, identity verification (KYC), and admin approval before public listing. We may refuse, suspend, or terminate accounts that violate these terms or pose a risk to users or the platform.',
      ],
    },
    {
      heading: '4. Bookings and payments',
      paragraphs: [
        'Bookings follow the lifecycle shown in the app (request, acceptance, service in progress, completion). Payment is processed through Paystack where applicable; funds may be held until job completion according to our payment and dispute policies.',
        'Fees, refunds, cancellations, and disputes are handled according to in-app status, admin review where required, and applicable Nigerian law. Chargebacks or fraudulent payment activity may result in account restriction.',
      ],
    },
    {
      heading: '5. Reviews, messaging, and conduct',
      paragraphs: [
        'Users must not harass others, post illegal content, attempt fraud, circumvent payments, or misuse personal data obtained through the platform.',
        'Reviews must be honest and tied to completed bookings. We may remove content or restrict accounts that abuse reviews or chat.',
      ],
    },
    {
      heading: '6. Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, Bundo is not liable for indirect, incidental, or consequential damages arising from services performed by artisans or from platform downtime.',
        'Our total liability for any claim relating to the services is limited to the fees you paid to Bundo for the relevant booking in the three months before the claim.',
      ],
    },
    {
      heading: '7. Contact',
      paragraphs: [`Questions about these terms: ${BUNDO_SUPPORT_EMAIL}.`],
    },
  ],
};

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  summary: 'How Bundo collects, uses, and protects personal information when you use our marketplace.',
  lastUpdated: '19 May 2026',
  sections: [
    {
      heading: '1. Information we collect',
      paragraphs: ['We collect information you provide and data generated when you use Bundo:'],
      bullets: [
        'Account data: name, email, phone number, role (client or artisan), and Firebase authentication identifiers.',
        'Profile and KYC data for artisans: business details, location, verification documents, portfolio images, and bank details for payouts.',
        'Transaction data: bookings, payments, messages, reviews, notifications, and dispute records.',
        'Technical data: device/browser information, push notification tokens if you opt in, and logs used for security and reliability.',
      ],
    },
    {
      heading: '2. How we use information',
      paragraphs: ['We use personal data to:'],
      bullets: [
        'Operate the marketplace — matching customers with artisans, processing bookings and payments, and sending service-related notifications.',
        'Verify artisans and reduce fraud through KYC review and admin moderation.',
        'Improve safety — investigating disputes, abuse reports, and platform rule violations.',
        'Communicate with you about your account, bookings, and product updates (according to your notification preferences).',
      ],
    },
    {
      heading: '3. Sharing',
      paragraphs: [
        'Customers and artisans involved in a booking can see relevant profile and booking information. Message content is visible to participants in the thread; admins may access conversations for support, moderation, fraud prevention, and disputes.',
        'We use service providers (Firebase, Paystack, Cloudinary, hosting partners) who process data on our behalf under appropriate agreements. We do not sell your personal information.',
      ],
    },
    {
      heading: '4. Retention and security',
      paragraphs: [
        'We retain data as long as needed to provide the service, comply with law, and resolve disputes. Deleted accounts are anonymized or restricted as described in the app; some records may be kept where legally required.',
        'We apply reasonable technical and organizational measures to protect data. No system is completely secure; report suspected breaches to us promptly.',
      ],
    },
    {
      heading: '5. Your choices',
      paragraphs: [
        'You can update phone and notification preferences in Settings, change your display name, and request password reset via email.',
        'You may delete your account from Settings; this restricts access and anonymizes core account fields subject to legal retention needs.',
        'You can disable browser push notifications in your device or browser settings.',
      ],
    },
    {
      heading: '6. Contact',
      paragraphs: [`Privacy questions or data requests: ${BUNDO_SUPPORT_EMAIL}.`],
    },
  ],
};
