# ElevenLabs + Vonage Voice Integration Guide

Ultra-realistic AI voices for your Vonage voice applications. This integration lets you use ElevenLabs Text-to-Speech with Vonage Voice API across PSTN, SIP, and WebRTC calls.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Client Configuration](#client-configuration)
4. [API Reference](#api-reference)
5. [Integration Examples](#integration-examples)
   - [Simple Outbound Call](#example-1-simple-outbound-call)
   - [IVR Menu System](#example-2-ivr-menu-system)
   - [AI Conversational Agent](#example-3-ai-conversational-agent)
   - [Appointment Reminder System](#example-4-appointment-reminder-system)
   - [Multi-Language Support](#example-5-multi-language-support)
   - [Call Centre Integration](#example-6-call-centre-integration)
   - [SIP Endpoint Integration](#example-7-sip-endpoint-integration)
   - [WebRTC Client SDK](#example-8-webrtc-client-sdk)
   - [Webhook-Driven Conversations](#example-9-webhook-driven-conversations)
   - [Survey / Feedback Collection](#example-10-survey--feedback-collection)
6. [Voice Selection Guide](#voice-selection-guide)
7. [Voice Tuning](#voice-tuning)
8. [Postman Setup](#postman-setup)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

- Vonage Application with Voice capability
- Vonage number linked to your application
- ElevenLabs account with API key
- The integration deployed and running

### Architecture Overview

```
┌──────────────────┐         ┌─────────────────────────┐         ┌──────────────┐
│                  │         │                         │         │              │
│   Your Backend   │────────▶│   This Integration      │────────▶│   Vonage     │
│   or Postman     │  REST   │                         │  Voice  │   Voice API  │
│                  │   API   │  • Manages Vonage auth  │   API   │              │
└──────────────────┘         │  • Manages EL configs   │         └──────┬───────┘
                             │  • Generates TTS audio  │                │
                             │  • Builds NCCOs         │                │
                             │                         │                ▼
                             └────────────┬────────────┘         ┌──────────────┐
                                          │                      │              │
                                          │ TTS API              │  Phone/SIP/  │
                                          ▼                      │   WebRTC     │
                             ┌─────────────────────────┐         │              │
                             │                         │         └──────────────┘
                             │      ElevenLabs         │
                             │                         │
                             └─────────────────────────┘
```

---

## Authentication

### Step 1: Configure Vonage Credentials

The integration uses the same authentication as standard Vonage applications: **Application ID + Private Key**.

**Using cURL:**

```bash
curl -X POST https://your-integration-url/api/vonage/config \
  -F "appId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" \
  -F "privateKey=@/path/to/private.key" \
  -F "apiKey=abc12345" \
  -F "apiSecret=AbCdEf123456"
```

**Using Node.js:**

```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const form = new FormData();
form.append('appId', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
form.append('privateKey', fs.createReadStream('./private.key'));
form.append('apiKey', 'abc12345');
form.append('apiSecret', 'AbCdEf123456');

const response = await fetch('https://your-integration-url/api/vonage/config', {
  method: 'POST',
  body: form
});

console.log(await response.json());
// { success: true, appId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }
```

**Using Python:**

```python
import requests

files = {
    'privateKey': open('private.key', 'rb')
}
data = {
    'appId': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'apiKey': 'abc12345',
    'apiSecret': 'AbCdEf123456'
}

response = requests.post(
    'https://your-integration-url/api/vonage/config',
    files=files,
    data=data
)
print(response.json())
```

### Verify Configuration

```bash
curl https://your-integration-url/api/vonage/config/status
# { "configured": true, "appId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }
```

---

## Client Configuration

Each client (your application, customer, tenant) gets their own ElevenLabs configuration. This allows:

- Multiple clients sharing one integration instance
- Each client using their own ElevenLabs API key and quota
- Different voice settings per client

### Configure a Client

```bash
curl -X POST https://your-integration-url/api/client/config \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "my-app",
    "elevenLabsApiKey": "your-elevenlabs-api-key",
    "voiceId": "rachel",
    "stability": 0.5,
    "similarityBoost": 0.75
  }'
```

### Full Configuration Options

```json
{
  "clientId": "my-app",
  "elevenLabsApiKey": "sk_...",
  "voiceId": "rachel",
  "model": "eleven_flash_v2_5",
  "stability": 0.5,
  "similarityBoost": 0.75,
  "style": 0,
  "useSpeakerBoost": true,
  "bargeIn": false,
  "webhooks": {
    "onCallStart": "https://your-server.com/hooks/call-start",
    "onCallEnd": "https://your-server.com/hooks/call-end",
    "onSpeech": "https://your-server.com/hooks/speech"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| clientId | string | required | Unique identifier for this client |
| elevenLabsApiKey | string | required | ElevenLabs API key |
| voiceId | string | "rachel" | Voice alias or ElevenLabs voice ID |
| model | string | "eleven_flash_v2_5" | ElevenLabs model |
| stability | number | 0.5 | Voice stability (0-1) |
| similarityBoost | number | 0.75 | Voice similarity (0-1) |
| style | number | 0 | Style exaggeration (0-1) |
| useSpeakerBoost | boolean | true | Enhance voice clarity |
| bargeIn | boolean | false | Allow caller to interrupt |
| webhooks | object | {} | Webhook URLs for events |

---

## API Reference

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check |
| `/_/health` | GET | VCR health endpoint |
| `/api/vonage/config/status` | GET | Vonage configuration status |
| `/api/calls/active` | GET | List active calls |

### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vonage/config` | POST | Configure Vonage credentials |
| `/api/vonage/config` | DELETE | Clear Vonage configuration |
| `/api/client/config` | POST | Configure client ElevenLabs |
| `/api/client/config/:clientId` | GET | Get client configuration |
| `/api/client/config/:clientId` | DELETE | Remove client configuration |
| `/api/voices` | GET | List available voices |

### Text-to-Speech

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tts/generate` | POST | Generate audio from text |

### Voice Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/call/outbound` | POST | Initiate outbound call |
| `/api/call/:callId/speak` | POST | Send TTS to active call |
| `/api/ncco/build` | POST | Build NCCO with ElevenLabs |

### Webhooks (received by the integration)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/voice/webhooks/answer` | GET/POST | Answer webhook |
| `/voice/webhooks/events` | POST | Call events |
| `/voice/webhooks/input` | POST | Speech/DTMF input |

---

## Integration Examples

### Example 1: Simple Outbound Call

Make a call and play a message using ElevenLabs TTS.

**cURL:**

```bash
curl -X POST https://your-integration-url/api/call/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "my-app",
    "to": "447700900123",
    "from": "447700900456",
    "text": "Hello! This is a test call using ElevenLabs text to speech. The voice quality is incredibly realistic. Goodbye!"
  }'
```

**Node.js:**

```javascript
const fetch = require('node-fetch');

async function makeCall(to, message) {
  const response = await fetch('https://your-integration-url/api/call/outbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'my-app',
      to: to,
      from: process.env.VONAGE_NUMBER,
      text: message
    })
  });
  
  const result = await response.json();
  console.log('Call initiated:', result.uuid);
  return result;
}

// Usage
makeCall('447700900123', 'Hello! Your order has been shipped.');
```

**Python:**

```python
import requests
import os

def make_call(to: str, message: str):
    response = requests.post(
        'https://your-integration-url/api/call/outbound',
        json={
            'clientId': 'my-app',
            'to': to,
            'from': os.environ['VONAGE_NUMBER'],
            'text': message
        }
    )
    result = response.json()
    print(f"Call initiated: {result['uuid']}")
    return result

# Usage
make_call('447700900123', 'Hello! Your order has been shipped.')
```

---

### Example 2: IVR Menu System

Create an interactive voice response system with DTMF input.

**Node.js:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'my-ivr';

// Initiate IVR call
async function startIVRCall(phoneNumber) {
  // Build the IVR NCCO
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [
        { type: 'speak', text: 'Welcome to Acme Corporation.' },
        { type: 'speak', text: 'For sales, press 1. For support, press 2. For billing, press 3. To speak with an operator, press 0.' },
        {
          type: 'input',
          inputType: ['dtmf'],
          dtmf: { maxDigits: 1, timeOut: 10 },
          eventUrl: ['https://your-server.com/ivr/dtmf-handler']
        },
        { type: 'speak', text: 'We did not receive your selection. Goodbye.' }
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  
  // Make the call with the built NCCO
  const callResponse = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: phoneNumber,
      from: process.env.VONAGE_NUMBER,
      ncco: ncco  // Pass the pre-built NCCO
    })
  });
  
  return callResponse.json();
}

// Handle DTMF input
app.post('/ivr/dtmf-handler', async (req, res) => {
  const { dtmf } = req.body;
  const digit = dtmf?.digits;
  
  let responseText;
  let transferNumber;
  
  switch (digit) {
    case '1':
      responseText = 'Connecting you to our sales team. Please hold.';
      transferNumber = '447700900001';
      break;
    case '2':
      responseText = 'Connecting you to technical support. Please hold.';
      transferNumber = '447700900002';
      break;
    case '3':
      responseText = 'Connecting you to our billing department. Please hold.';
      transferNumber = '447700900003';
      break;
    case '0':
      responseText = 'Please hold while I connect you to an operator.';
      transferNumber = '447700900000';
      break;
    default:
      responseText = 'Invalid selection. Goodbye.';
  }
  
  // Build response NCCO with ElevenLabs
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [
        { type: 'speak', text: responseText },
        ...(transferNumber ? [{
          action: 'connect',
          endpoint: [{ type: 'phone', number: transferNumber }]
        }] : [])
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  res.json(ncco);
});

app.listen(3000);
```

---

### Example 3: AI Conversational Agent

Build an AI-powered phone agent that responds to natural speech.

**Node.js with OpenAI:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'ai-agent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store conversation history per call
const conversations = new Map();

// Configure client with webhook
async function setupClient() {
  await fetch(`${INTEGRATION_URL}/api/client/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'jessica',  // Empathetic voice
      stability: 0.6,
      similarityBoost: 0.8,
      webhooks: {
        onSpeech: 'https://your-server.com/ai/speech-handler',
        onCallEnd: 'https://your-server.com/ai/call-ended'
      }
    })
  });
}

// Start AI call
async function startAICall(phoneNumber, systemPrompt) {
  const callId = `call-${Date.now()}`;
  
  // Initialize conversation
  conversations.set(callId, {
    messages: [{ role: 'system', content: systemPrompt }],
    phoneNumber
  });
  
  const response = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: phoneNumber,
      from: process.env.VONAGE_NUMBER,
      text: 'Hello! I\'m an AI assistant. How can I help you today?'
    })
  });
  
  const result = await response.json();
  
  // Map UUID to our callId for tracking
  conversations.set(result.uuid, conversations.get(callId));
  
  return result;
}

// Handle speech input
app.post('/ai/speech-handler', async (req, res) => {
  const { callId, uuid, text } = req.body;
  
  const conversation = conversations.get(uuid) || conversations.get(callId);
  if (!conversation) {
    console.error('No conversation found for', uuid || callId);
    return res.sendStatus(200);
  }
  
  // Add user message
  conversation.messages.push({ role: 'user', content: text });
  
  try {
    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: conversation.messages,
      max_tokens: 150,  // Keep responses concise for phone
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    // Add assistant message to history
    conversation.messages.push({ role: 'assistant', content: aiResponse });
    
    // Speak the response
    await fetch(`${INTEGRATION_URL}/api/call/${uuid}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: aiResponse })
    });
    
  } catch (error) {
    console.error('AI error:', error);
    
    await fetch(`${INTEGRATION_URL}/api/call/${uuid}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'I apologize, I encountered an issue. Could you please repeat that?' })
    });
  }
  
  res.sendStatus(200);
});

// Cleanup on call end
app.post('/ai/call-ended', (req, res) => {
  const { callId, uuid } = req.body;
  conversations.delete(uuid);
  conversations.delete(callId);
  console.log('Call ended:', uuid);
  res.sendStatus(200);
});

setupClient().then(() => {
  app.listen(3000, () => console.log('AI Agent server running'));
});
```

**Usage:**

```javascript
// Start an AI support call
startAICall('447700900123', `
  You are a helpful customer support agent for TechCorp.
  Be friendly, concise, and helpful.
  Keep responses under 2-3 sentences for natural phone conversation.
  If you don't know something, offer to connect them with a human agent.
`);
```

---

### Example 4: Appointment Reminder System

Automated appointment reminders with confirmation.

**Node.js:**

```javascript
const fetch = require('node-fetch');

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'appointment-reminders';

async function sendAppointmentReminder(appointment) {
  const { 
    patientName, 
    patientPhone, 
    doctorName, 
    appointmentDate, 
    appointmentTime,
    clinicPhone 
  } = appointment;
  
  // Format the date nicely for speech
  const dateForSpeech = new Date(appointmentDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  const message = `
    Hello ${patientName}. This is a reminder from City Medical Centre.
    You have an appointment with Doctor ${doctorName} on ${dateForSpeech} at ${appointmentTime}.
    Please arrive 10 minutes early and bring your ID and insurance card.
    Press 1 to confirm your appointment.
    Press 2 to request a reschedule.
    Press 3 to cancel your appointment.
  `;
  
  // Build NCCO with confirmation handling
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [
        { type: 'speak', text: message },
        {
          type: 'input',
          inputType: ['dtmf'],
          dtmf: { maxDigits: 1, timeOut: 10 },
          eventUrl: [`https://your-server.com/appointments/response?appointmentId=${appointment.id}`]
        },
        { type: 'speak', text: 'We did not receive your response. We will try again later. Goodbye.' }
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  
  // Make the reminder call
  const response = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: patientPhone,
      from: clinicPhone,
      ncco: ncco
    })
  });
  
  return response.json();
}

// Handle patient response
app.post('/appointments/response', async (req, res) => {
  const { appointmentId } = req.query;
  const { dtmf } = req.body;
  const digit = dtmf?.digits;
  
  let responseText;
  
  switch (digit) {
    case '1':
      responseText = 'Thank you for confirming. We look forward to seeing you. Goodbye.';
      await updateAppointmentStatus(appointmentId, 'confirmed');
      break;
    case '2':
      responseText = 'We will have our scheduling team call you to reschedule. Goodbye.';
      await updateAppointmentStatus(appointmentId, 'reschedule-requested');
      break;
    case '3':
      responseText = 'Your appointment has been cancelled. If you need to book a new appointment, please call us. Goodbye.';
      await updateAppointmentStatus(appointmentId, 'cancelled');
      break;
    default:
      responseText = 'Invalid selection. Please call our office directly. Goodbye.';
  }
  
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [{ type: 'speak', text: responseText }]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  res.json(ncco);
});

// Batch send reminders
async function sendDailyReminders() {
  const appointments = await getAppointmentsForTomorrow();
  
  for (const appointment of appointments) {
    await sendAppointmentReminder(appointment);
    // Add delay between calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

---

### Example 5: Multi-Language Support

Handle calls in multiple languages with appropriate voices.

**Node.js:**

```javascript
const LANGUAGE_CONFIG = {
  'en-GB': {
    voiceId: 'archer',       // British male
    greeting: 'Hello, welcome to our service.',
    menuPrompt: 'Press 1 for English. Presione 2 para español. Appuyez sur 3 pour le français.'
  },
  'en-US': {
    voiceId: 'rachel',       // American female
    greeting: 'Hi there, thanks for calling.',
    menuPrompt: 'Press 1 for English. Presione 2 para español.'
  },
  'es': {
    voiceId: 'eleven_multilingual_v2_es',  // Use multilingual model
    greeting: 'Hola, bienvenido a nuestro servicio.',
    menuPrompt: 'Presione 1 para continuar en español.'
  },
  'fr': {
    voiceId: 'eleven_multilingual_v2_fr',
    greeting: 'Bonjour, bienvenue dans notre service.',
    menuPrompt: 'Appuyez sur 1 pour continuer en français.'
  }
};

// Configure clients for each language
async function setupLanguageClients() {
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
    await fetch(`${INTEGRATION_URL}/api/client/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: `multilang-${lang}`,
        elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
        voiceId: config.voiceId,
        model: lang.startsWith('en') ? 'eleven_flash_v2_5' : 'eleven_multilingual_v2'
      })
    });
  }
}

// Start a multilingual call
async function startMultilingualCall(phoneNumber, detectedLanguage = 'en-GB') {
  const config = LANGUAGE_CONFIG[detectedLanguage] || LANGUAGE_CONFIG['en-GB'];
  const clientId = `multilang-${detectedLanguage}`;
  
  const response = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: clientId,
      to: phoneNumber,
      from: process.env.VONAGE_NUMBER,
      text: config.greeting
    })
  });
  
  return response.json();
}

// Language selection IVR
async function startLanguageSelectionCall(phoneNumber) {
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'multilang-en-GB',
      actions: [
        { type: 'speak', text: LANGUAGE_CONFIG['en-GB'].menuPrompt },
        {
          type: 'input',
          inputType: ['dtmf'],
          dtmf: { maxDigits: 1, timeOut: 5 },
          eventUrl: ['https://your-server.com/language-selected']
        }
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  
  return fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'multilang-en-GB',
      to: phoneNumber,
      from: process.env.VONAGE_NUMBER,
      ncco: ncco
    })
  });
}
```

---

### Example 6: Call Centre Integration

Integrate with your call centre for agent assist and call handling.

**Node.js:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'call-centre';

// Queue management
const callQueue = [];
const activeAgents = new Map();

// Customer initiates call (inbound simulation via outbound callback)
async function handleIncomingCustomer(customerPhone, customerId) {
  // Generate greeting with ElevenLabs
  const response = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: customerPhone,
      from: process.env.VONAGE_NUMBER,
      text: 'Thank you for calling TechSupport. Please hold while we connect you with the next available agent.',
      ncco: [
        {
          action: 'conversation',
          name: `queue-${customerId}`,
          musicOnHoldUrl: ['https://your-server.com/hold-music.mp3']
        }
      ]
    })
  });
  
  const call = await response.json();
  
  // Add to queue
  callQueue.push({
    customerId,
    customerPhone,
    callUuid: call.uuid,
    queuedAt: Date.now()
  });
  
  // Notify available agents
  notifyAgents();
  
  return call;
}

// Agent picks up call
async function agentPickupCall(agentId, agentPhone) {
  const queuedCall = callQueue.shift();
  
  if (!queuedCall) {
    return { error: 'No calls in queue' };
  }
  
  // Call the agent
  const agentCall = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: agentPhone,
      from: process.env.VONAGE_NUMBER,
      text: `Incoming call from customer ${queuedCall.customerId}. Connecting now.`,
      ncco: [
        {
          action: 'conversation',
          name: `queue-${queuedCall.customerId}`
        }
      ]
    })
  });
  
  const agentCallResult = await agentCall.json();
  
  // Track active call
  activeAgents.set(agentId, {
    agentPhone,
    agentUuid: agentCallResult.uuid,
    customerUuid: queuedCall.callUuid,
    customerId: queuedCall.customerId,
    connectedAt: Date.now()
  });
  
  return agentCallResult;
}

// Agent triggers TTS to customer (e.g., reading a script)
async function agentSpeakToCustomer(agentId, text) {
  const activeCall = activeAgents.get(agentId);
  
  if (!activeCall) {
    return { error: 'No active call for agent' };
  }
  
  // Play TTS to customer
  const response = await fetch(`${INTEGRATION_URL}/api/call/${activeCall.customerUuid}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  
  return response.json();
}

// Supervisor barge-in with announcement
async function supervisorAnnouncement(callUuid, message) {
  const response = await fetch(`${INTEGRATION_URL}/api/call/${callUuid}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Attention: ${message}`
    })
  });
  
  return response.json();
}

// API endpoints
app.post('/call-centre/incoming', async (req, res) => {
  const { customerPhone, customerId } = req.body;
  const result = await handleIncomingCustomer(customerPhone, customerId);
  res.json(result);
});

app.post('/call-centre/agent/pickup', async (req, res) => {
  const { agentId, agentPhone } = req.body;
  const result = await agentPickupCall(agentId, agentPhone);
  res.json(result);
});

app.post('/call-centre/agent/speak', async (req, res) => {
  const { agentId, text } = req.body;
  const result = await agentSpeakToCustomer(agentId, text);
  res.json(result);
});

app.listen(3000);
```

---

### Example 7: SIP Endpoint Integration

Connect to SIP endpoints (PBX, SIP trunks).

**Node.js:**

```javascript
const fetch = require('node-fetch');

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'sip-integration';

// Call a SIP endpoint
async function callSipEndpoint(sipUri, message) {
  // First build the NCCO with ElevenLabs TTS
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [
        { type: 'speak', text: message },
        {
          type: 'input',
          inputType: ['speech'],
          speech: { language: 'en-US', endOnSilence: 2 }
        }
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  
  // Make the SIP call using Vonage directly (via your own Vonage SDK call)
  // Note: The integration handles TTS, you handle the SIP-specific call setup
  
  // Example using Vonage SDK directly for SIP
  const vonage = new Vonage({
    applicationId: process.env.VONAGE_APP_ID,
    privateKey: process.env.VONAGE_PRIVATE_KEY
  });
  
  const response = await vonage.voice.createOutboundCall({
    to: [{
      type: 'sip',
      uri: sipUri,  // e.g., 'sip:user@your-pbx.com'
      headers: {
        'X-Custom-Header': 'value'
      }
    }],
    from: { type: 'phone', number: process.env.VONAGE_NUMBER },
    ncco: ncco  // Use the NCCO built by the integration
  });
  
  return response;
}

// Example: Call internal PBX extension
callSipEndpoint('sip:1001@pbx.company.com', 'Hello, this is an automated message from the system.');

// Example: Call SIP trunk
callSipEndpoint('sip:+14155551234@sip-trunk.carrier.com', 'This call is being connected via SIP trunk.');
```

---

### Example 8: WebRTC Client SDK

Use with Vonage Client SDK (WebRTC) for in-browser/app calls.

**Backend (Node.js):**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const { Vonage } = require('@vonage/server-sdk');
const { tokenGenerate } = require('@vonage/jwt');

const app = express();
app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'webrtc-app';

// Generate JWT for Client SDK
app.get('/api/token/:userId', (req, res) => {
  const { userId } = req.params;
  
  const token = tokenGenerate(
    process.env.VONAGE_APP_ID,
    process.env.VONAGE_PRIVATE_KEY,
    {
      sub: userId,
      acl: {
        paths: {
          '/*/users/**': {},
          '/*/conversations/**': {},
          '/*/sessions/**': {},
          '/*/devices/**': {},
          '/*/image/**': {},
          '/*/media/**': {},
          '/*/applications/**': {},
          '/*/push/**': {},
          '/*/knocking/**': {},
          '/*/legs/**': {}
        }
      }
    }
  );
  
  res.json({ token });
});

// Handle inbound WebRTC call with ElevenLabs greeting
app.post('/voice/webhooks/answer', async (req, res) => {
  const { from } = req.body;
  
  // Build greeting with ElevenLabs
  const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      actions: [
        { type: 'speak', text: `Hello, you are connected to our AI assistant. How can I help you?` },
        {
          type: 'input',
          inputType: ['speech'],
          speech: { language: 'en-US', endOnSilence: 2 },
          eventUrl: ['https://your-server.com/webrtc/speech']
        }
      ]
    })
  });
  
  const { ncco } = await nccoResponse.json();
  res.json(ncco);
});

app.listen(3000);
```

**Frontend (JavaScript):**

```javascript
import { createClient } from '@vonage/client-sdk';

const client = createClient();

async function initializeCall() {
  // Get token from your backend
  const tokenResponse = await fetch(`/api/token/${userId}`);
  const { token } = await tokenResponse.json();
  
  // Create session
  await client.createSession(token);
  
  // Make call - will receive ElevenLabs TTS from server
  const call = await client.serverCall({
    to: 'AI-Assistant'
  });
  
  call.on('member:call:status', (event) => {
    console.log('Call status:', event.status);
  });
  
  return call;
}

// Hang up
function endCall(call) {
  call.hangup();
}
```

---

### Example 9: Webhook-Driven Conversations

Let your backend control the entire conversation flow via webhooks.

**Node.js:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'webhook-driven';

// Configure client with all webhooks
async function setupClient() {
  await fetch(`${INTEGRATION_URL}/api/client/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'jessica',
      webhooks: {
        onCallStart: 'https://your-server.com/hooks/call-start',
        onCallEnd: 'https://your-server.com/hooks/call-end',
        onSpeech: 'https://your-server.com/hooks/speech'
      }
    })
  });
}

// Track conversation state
const callStates = new Map();

// Call started - initialize state
app.post('/hooks/call-start', (req, res) => {
  const { callId, uuid, to, from } = req.body;
  
  callStates.set(uuid, {
    step: 'greeting',
    data: {},
    history: []
  });
  
  console.log(`Call started: ${uuid} from ${from} to ${to}`);
  res.sendStatus(200);
});

// Speech received - process and respond
app.post('/hooks/speech', async (req, res) => {
  const { callId, uuid, text } = req.body;
  
  const state = callStates.get(uuid);
  if (!state) {
    return res.sendStatus(200);
  }
  
  state.history.push({ role: 'user', text });
  
  let responseText;
  let nextStep = state.step;
  
  // State machine for conversation
  switch (state.step) {
    case 'greeting':
      responseText = "I'd be happy to help you today. Could you please tell me your account number?";
      nextStep = 'get-account';
      break;
      
    case 'get-account':
      // Extract account number from speech
      const accountMatch = text.match(/\d+/);
      if (accountMatch) {
        state.data.accountNumber = accountMatch[0];
        responseText = `Thank you. I found your account ending in ${state.data.accountNumber.slice(-4)}. What can I help you with today?`;
        nextStep = 'get-intent';
      } else {
        responseText = "I didn't catch that. Could you please repeat your account number?";
      }
      break;
      
    case 'get-intent':
      // Simple intent detection
      const lowerText = text.toLowerCase();
      if (lowerText.includes('balance')) {
        state.data.intent = 'balance';
        responseText = `Your current balance is $1,234.56. Is there anything else I can help with?`;
        nextStep = 'follow-up';
      } else if (lowerText.includes('payment') || lowerText.includes('pay')) {
        state.data.intent = 'payment';
        responseText = `I can help you make a payment. How much would you like to pay?`;
        nextStep = 'get-amount';
      } else {
        responseText = "I can help you check your balance or make a payment. Which would you like?";
      }
      break;
      
    case 'get-amount':
      const amountMatch = text.match(/\$?(\d+)/);
      if (amountMatch) {
        state.data.paymentAmount = amountMatch[1];
        responseText = `I'll process a payment of $${state.data.paymentAmount}. Please confirm by saying yes or no.`;
        nextStep = 'confirm-payment';
      } else {
        responseText = "I didn't catch the amount. How much would you like to pay?";
      }
      break;
      
    case 'confirm-payment':
      if (text.toLowerCase().includes('yes')) {
        responseText = `Your payment of $${state.data.paymentAmount} has been processed. Is there anything else I can help with?`;
        nextStep = 'follow-up';
      } else {
        responseText = "Payment cancelled. Is there anything else I can help with?";
        nextStep = 'follow-up';
      }
      break;
      
    case 'follow-up':
      if (text.toLowerCase().includes('no') || text.toLowerCase().includes('that\'s all')) {
        responseText = "Thank you for calling. Have a great day. Goodbye.";
        nextStep = 'complete';
      } else {
        responseText = "Sure, what else can I help you with?";
        nextStep = 'get-intent';
      }
      break;
      
    default:
      responseText = "Thank you for calling. Goodbye.";
      nextStep = 'complete';
  }
  
  state.step = nextStep;
  state.history.push({ role: 'assistant', text: responseText });
  
  // Send response via TTS
  await fetch(`${INTEGRATION_URL}/api/call/${uuid}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: responseText })
  });
  
  res.sendStatus(200);
});

// Call ended - cleanup
app.post('/hooks/call-end', (req, res) => {
  const { uuid, status, duration } = req.body;
  
  const state = callStates.get(uuid);
  if (state) {
    console.log(`Call ended: ${uuid}, duration: ${duration}s, final step: ${state.step}`);
    console.log('Collected data:', state.data);
    
    // Save to database, analytics, etc.
    saveCallData(uuid, state);
    
    callStates.delete(uuid);
  }
  
  res.sendStatus(200);
});

setupClient().then(() => {
  app.listen(3000, () => console.log('Webhook server running'));
});
```

---

### Example 10: Survey / Feedback Collection

Collect customer feedback via voice with transcription.

**Node.js:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const INTEGRATION_URL = 'https://your-integration-url';
const CLIENT_ID = 'survey';

// Survey questions
const SURVEY_QUESTIONS = [
  {
    id: 'satisfaction',
    text: 'On a scale of 1 to 5, how satisfied are you with our service?',
    type: 'rating'
  },
  {
    id: 'recommend',
    text: 'Would you recommend us to a friend? Please say yes or no.',
    type: 'boolean'
  },
  {
    id: 'feedback',
    text: 'Do you have any additional feedback you would like to share? Please speak freely.',
    type: 'freeform'
  }
];

const surveyResponses = new Map();

// Start survey call
async function startSurvey(phoneNumber, customerId, orderId) {
  const surveyId = `survey-${Date.now()}`;
  
  // Initialize survey state
  surveyResponses.set(surveyId, {
    customerId,
    orderId,
    currentQuestion: 0,
    answers: {},
    startedAt: Date.now()
  });
  
  const introText = `
    Hello! Thank you for your recent purchase. 
    We would love to hear your feedback. 
    This survey will only take about one minute.
    ${SURVEY_QUESTIONS[0].text}
  `;
  
  const response = await fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      to: phoneNumber,
      from: process.env.VONAGE_NUMBER,
      text: introText,
      ncco: [
        {
          action: 'input',
          type: ['speech'],
          eventUrl: [`https://your-server.com/survey/response?surveyId=${surveyId}`],
          eventMethod: 'POST',
          speech: {
            language: 'en-US',
            endOnSilence: 3,
            maxDuration: 60
          }
        }
      ]
    })
  });
  
  const result = await response.json();
  
  // Map UUID to surveyId
  surveyResponses.set(result.uuid, surveyResponses.get(surveyId));
  surveyResponses.get(surveyId).uuid = result.uuid;
  
  return result;
}

// Handle survey response
app.post('/survey/response', async (req, res) => {
  const { surveyId } = req.query;
  const { uuid, speech } = req.body;
  
  const survey = surveyResponses.get(uuid) || surveyResponses.get(surveyId);
  if (!survey) {
    return res.json([{
      action: 'talk',
      text: 'Thank you. Goodbye.',
      language: 'en-US'
    }]);
  }
  
  const userResponse = speech?.results?.[0]?.text || '';
  const currentQ = SURVEY_QUESTIONS[survey.currentQuestion];
  
  // Process response based on question type
  let processedAnswer;
  switch (currentQ.type) {
    case 'rating':
      const rating = parseInt(userResponse.match(/\d/)?.[0] || '0');
      processedAnswer = rating >= 1 && rating <= 5 ? rating : null;
      break;
    case 'boolean':
      const lower = userResponse.toLowerCase();
      processedAnswer = lower.includes('yes') ? true : lower.includes('no') ? false : null;
      break;
    case 'freeform':
      processedAnswer = userResponse;
      break;
  }
  
  // Store answer
  survey.answers[currentQ.id] = {
    raw: userResponse,
    processed: processedAnswer
  };
  
  // Move to next question
  survey.currentQuestion++;
  
  let responseText;
  let ncco;
  
  if (survey.currentQuestion < SURVEY_QUESTIONS.length) {
    // Ask next question
    const nextQ = SURVEY_QUESTIONS[survey.currentQuestion];
    responseText = `Thank you. ${nextQ.text}`;
    
    const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        actions: [
          { type: 'speak', text: responseText },
          {
            type: 'input',
            inputType: ['speech'],
            speech: { 
              language: 'en-US', 
              endOnSilence: 3,
              maxDuration: currentQ.type === 'freeform' ? 120 : 30
            },
            eventUrl: [`https://your-server.com/survey/response?surveyId=${surveyId}`]
          }
        ]
      })
    });
    
    ncco = (await nccoResponse.json()).ncco;
  } else {
    // Survey complete
    responseText = 'Thank you so much for your feedback. It helps us improve our service. Have a wonderful day. Goodbye.';
    
    const nccoResponse = await fetch(`${INTEGRATION_URL}/api/ncco/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        actions: [{ type: 'speak', text: responseText }]
      })
    });
    
    ncco = (await nccoResponse.json()).ncco;
    
    // Save completed survey
    survey.completedAt = Date.now();
    await saveSurveyResults(survey);
  }
  
  res.json(ncco);
});

// Save survey results
async function saveSurveyResults(survey) {
  console.log('Survey completed:', {
    customerId: survey.customerId,
    orderId: survey.orderId,
    duration: Math.round((survey.completedAt - survey.startedAt) / 1000),
    answers: survey.answers
  });
  
  // Save to your database
  // await db.surveys.insert(survey);
}

app.listen(3000);
```

---

## Voice Selection Guide

### Conversational Voices (Recommended for Phone Calls)

These voices are specifically optimized for natural conversation:

| Alias | Name | Language | Gender | Best For |
|-------|------|----------|--------|----------|
| `eryn` | Eryn | en-US | Female | Casual, friendly conversations |
| `alexandra` | Alexandra | en-US | Female | Ultra-realistic, professional |
| `jessica` | Jessica | en-US | Female | Empathetic customer support |
| `angela` | Angela | en-US | Female | Down to earth, authentic |
| `hope` | Hope | en-US | Female | Upbeat, positive messaging |
| `archer` | Archer | en-GB | Male | Professional British |
| `mark` | Mark | en-US | Male | Relaxed, laid-back |
| `finn` | Finn | en-US | Male | Light, casual |
| `stuart` | Stuart | en-AU | Male | Australian professional |

### Standard Voices

| Alias | Name | Language | Gender |
|-------|------|----------|--------|
| `rachel` | Rachel | en-US | Female |
| `josh` | Josh | en-US | Male |
| `adam` | Adam | en-US | Male |
| `charlie` | Charlie | en-GB | Male |
| `charlotte` | Charlotte | en-GB | Female |
| `george` | George | en-GB | Male |
| `daniel` | Daniel | en-GB | Male |

### Using Custom Voice IDs

You can use any ElevenLabs voice ID directly:

```json
{
  "voiceId": "21m00Tcm4TlvDq8ikWAM"
}
```

To find your voice IDs, check your ElevenLabs dashboard or use their API.

---

## Voice Tuning

Fine-tune voice characteristics for your use case:

```json
{
  "stability": 0.5,
  "similarityBoost": 0.75,
  "style": 0,
  "useSpeakerBoost": true
}
```

### Parameters

| Parameter | Range | Low Value | High Value |
|-----------|-------|-----------|------------|
| `stability` | 0-1 | More expressive, variable | More consistent, stable |
| `similarityBoost` | 0-1 | More variation | Closer to original voice |
| `style` | 0-1 | Neutral delivery | Exaggerated style |
| `useSpeakerBoost` | bool | Natural | Enhanced clarity |

### Recommended Settings by Use Case

**Customer Support:**
```json
{ "stability": 0.6, "similarityBoost": 0.8, "style": 0.1 }
```

**Notifications/Alerts:**
```json
{ "stability": 0.7, "similarityBoost": 0.7, "style": 0 }
```

**Conversational AI:**
```json
{ "stability": 0.4, "similarityBoost": 0.75, "style": 0.2 }
```

**Formal Announcements:**
```json
{ "stability": 0.8, "similarityBoost": 0.9, "style": 0 }
```

---

## Postman Setup

### Import Collection

1. Download `postman_collection.json` from the repository
2. In Postman, click **Import** → **Upload Files**
3. Select the collection file

### Configure Variables

Edit the collection variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | Integration URL | `https://your-vcr-url.euw1.runtime.vonage.cloud` |
| `clientId` | Your client ID | `my-app` |
| `toNumber` | Test destination | `447700900123` |
| `fromNumber` | Your Vonage number | `447700900456` |

### Request Order

1. **Configure Vonage** - Upload your private key
2. **Configure Client** - Set your ElevenLabs API key
3. **List Voices** - See available voice options
4. **Generate TTS** - Test audio generation
5. **Make Call** - Test outbound calling

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Vonage not configured` | Missing Vonage credentials | POST to `/api/vonage/config` |
| `Client not configured` | Missing client config | POST to `/api/client/config` |
| `ElevenLabs API error: 401` | Invalid API key | Check your ElevenLabs key |
| `ElevenLabs API error: 429` | Rate limited | Reduce request frequency |
| `Audio not found` | Expired audio cache | Audio expires after 5 minutes |

### Error Response Format

```json
{
  "error": "Description of the error",
  "required": ["field1", "field2"]
}
```

### Implementing Retries

```javascript
async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Usage
const result = await callWithRetry(() => 
  fetch(`${INTEGRATION_URL}/api/call/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* ... */ })
  }).then(r => r.json())
);
```

---

## Best Practices

### 1. Keep Messages Concise

Phone conversations work best with short, clear messages:

```javascript
// Good
"Your order has shipped and will arrive Thursday."

// Too long
"Thank you for your order. We wanted to let you know that your order number 12345 
has been shipped via FedEx and according to our tracking information, it should 
arrive at your delivery address by Thursday of this week."
```

### 2. Use Natural Speech Patterns

Add pauses and natural flow:

```javascript
// Natural
"Hi there. I'm calling from Acme Corp about your recent inquiry."

// Robotic
"Hello I am calling from Acme Corporation regarding your inquiry."
```

### 3. Handle Silence Gracefully

Always have fallback responses:

```javascript
ncco: [
  { type: 'speak', text: 'Please tell me how I can help.' },
  {
    type: 'input',
    inputType: ['speech'],
    speech: { endOnSilence: 3 }
  },
  { type: 'speak', text: "I didn't catch that. Let me connect you with an agent." }
]
```

### 4. Cache Client Configurations

Configure clients once at startup, not per-request:

```javascript
// Good - configure once
await setupClients();
app.listen(3000);

// Avoid - configuring on each request
app.post('/call', async (req, res) => {
  await configureClient();  // Don't do this
  await makeCall();
});
```

### 5. Use Webhooks for Complex Flows

Let your backend control conversations rather than building huge NCCOs:

```javascript
// Good - webhook-driven
webhooks: {
  onSpeech: 'https://your-server.com/handle-speech'
}

// Avoid - giant static NCCO
ncco: [
  { /* 50 actions */ }
]
```

### 6. Monitor Call Quality

Track metrics and log important events:

```javascript
app.post('/hooks/call-end', (req, res) => {
  const { uuid, status, duration } = req.body;
  
  metrics.trackCall({
    uuid,
    status,
    duration,
    timestamp: Date.now()
  });
  
  if (status === 'failed') {
    alerts.notify(`Call ${uuid} failed`);
  }
  
  res.sendStatus(200);
});
```

### 7. Test with Real Numbers

Test thoroughly before production:

- Test with different phone types (mobile, landline)
- Test with different network conditions
- Test the full conversation flow end-to-end
- Test error scenarios (hang up early, no speech, etc.)

---

## Support

- **Vonage Voice API**: [developer.vonage.com](https://developer.vonage.com/voice/voice-api/overview)
- **ElevenLabs**: [docs.elevenlabs.io](https://docs.elevenlabs.io)
- **Vonage Support**: [support.vonage.com](https://support.vonage.com)

---

*Built for Vonage Voice API with ElevenLabs TTS*
