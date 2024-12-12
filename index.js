

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);  // Load from environment variables
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');

const app = express();

// Initialize Supabase client with environment variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

// Stripe webhook secret (set in your environment variables)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
