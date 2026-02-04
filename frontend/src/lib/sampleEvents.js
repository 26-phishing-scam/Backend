const now = new Date();

const iso = (offsetMinutes = 0) =>
  new Date(now.getTime() - offsetMinutes * 60 * 1000).toISOString();

export const sampleBatch = {
  events: [
    {
      ts: iso(10),
      type: 'login',
      url: 'https://login.example.com',
      meta: {
        username_present: true,
        form_action_domain: 'evil-login.com',
        page_domain: 'login.example.com',
      },
    },
    {
      ts: iso(9),
      type: 'password_input',
      url: 'https://login.example.com',
      meta: {
        password_field_present: true,
        form_action_domain: 'evil-login.com',
        page_domain: 'login.example.com',
      },
    },
    {
      ts: iso(8),
      type: 'payment',
      url: 'https://pay.example.com/checkout',
      meta: {
        amount: 129.5,
        currency: 'USD',
        card_present: true,
        merchant_domain: 'pay.example.com',
      },
    },
    {
      ts: iso(7),
      type: 'download',
      url: 'https://files.example.com/setup.exe',
      meta: {
        filename: 'setup.exe',
        file_ext: 'exe',
        size_bytes: 1048576,
        from_new_domain: true,
      },
    },
    {
      ts: iso(6),
      type: 'pii_input',
      url: 'https://example.com/signup',
      meta: {
        fields: ['email', 'phone', 'address'],
        count: 3,
        has_email: true,
        has_phone: true,
        has_address: true,
      },
    },
    {
      ts: iso(5),
      type: 'clipboard',
      url: 'https://example.com',
      meta: {
        action: 'write',
        contains_crypto_address: true,
      },
    },
    {
      ts: iso(4),
      type: 'redirect',
      url: 'https://example.com',
      meta: {
        chain_length: 4,
        final_domain: 'final.example.com',
      },
    },
    {
      ts: iso(3),
      type: 'form_submit',
      url: 'https://example.com/upload',
      meta: {
        form_action_domain: 'example.com',
        page_domain: 'example.com',
        has_file_upload: true,
        has_payment_fields: false,
      },
    },
  ],
};
