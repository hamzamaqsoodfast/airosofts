const express = require('express');
const stripe = require('stripe')('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');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');

const app = express();

// Initialize Supabase client with hardcoded credentials
const supabase = createClient(
  'https://ejfxiadnxrnsozfelovu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZnhpYWRueHJuc296ZmVsb3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIyOTMyMzQsImV4cCI6MjA0Nzg2OTIzNH0.-zHygvQ_ldcLWpFWaDo_FhhmhgkYSFjIdN8eTvA4yLo'
);

// Stripe webhook secret
const endpointSecret = 'https://ejfxiadnxrnsozfelovu.supabase.co';

// Use raw body parser for Stripe (required to validate webhook signature)
app.use(bodyParser.raw({ type: 'application/json' }));

// Webhook handler
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify the webhook signature and parse the event
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;  // Contains session details
    const customerEmail = session.customer_email;
    const amountTotal = session.amount_total;

    try {
      // Save the payment details to Supabase
      const { data, error } = await supabase
        .from('purchases')
        .insert([
          {
            email: customerEmail,
            amount: amountTotal / 100,  // Convert amount from cents to dollars
            purchase_date: new Date(),
          },
        ]);

      if (error) {
        console.error('Error saving to Supabase:', error.message);
        return res.status(500).send('Internal Server Error');
      }

      console.log('Purchase saved to Supabase:', data);
      return res.status(200).send('Success');
    } catch (error) {
      console.error('Error handling the session:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }

  // If event type is not handled
  res.status(200).send('Event type not processed');
});

// Start the server
const port = 3000;  // Fixed port
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
