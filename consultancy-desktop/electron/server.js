const express = require('express');
const axios = require('axios');
const multer = require('multer');
const { Server } = require('socket.io');

// WhatsApp configuration
const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Webhook verification endpoint
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook receiver for incoming messages
app.post('/webhook/whatsapp', async (req, res) => {
  const data = req.body;
  
  if (data.object === 'whatsapp_business_account') {
    data.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'messages') {
          handleIncomingMessage(change.value);
        }
      });
    });
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Send message endpoint
app.post('/api/whatsapp/send', async (req, res) => {
  const { to, message, type = 'text' } = req.body;
  
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: type,
        text: type === 'text' ? { body: message } : undefined
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
