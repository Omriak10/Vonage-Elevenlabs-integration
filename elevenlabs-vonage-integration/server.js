/**
 * ElevenLabs + Vonage Voice Integration
 * 
 * A modular, client-configurable integration for using ElevenLabs TTS
 * with Vonage Voice API. Designed for VCR deployment with full API access.
 * 
 * Authentication: Vonage App ID + Private Key (same as vishing-simulator)
 * TTS Provider: ElevenLabs (client brings their own API key)
 */

if (!process.env.VCR_PORT) {
    require('dotenv').config();
}

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Vonage } = require('@vonage/server-sdk');

const app = express();

// ==========================================
// CONFIGURATION
// ==========================================

const PORT = process.env.VCR_PORT || process.env.PORT || 8080;
const HOST = process.env.VCR_HOST || process.env.HOST || '0.0.0.0';
const isVCR = !!process.env.VCR_PORT;

// Application state
let vonageConfig = null; // { appId, privateKey, apiKey, apiSecret }
let clientConfigs = {};  // clientId -> ElevenLabs config

// Audio cache for generated audio (auto-expires)
let audioCache = {};
const AUDIO_CACHE_TTL = 300000; // 5 minutes

// Active calls state
let activeCalls = {};

// Default ElevenLabs settings (can be overridden per-client)
const DEFAULT_ELEVENLABS_CONFIG = {
    model: 'eleven_flash_v2_5',  // Fast model for low latency
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
    outputFormat: 'mp3_22050_32'
};

// Popular ElevenLabs voice IDs for reference
const ELEVENLABS_VOICES = {
    // Conversational (best for phone calls)
    'eryn': { id: 'dj3G1R1ilKoFKhBnWOzG', name: 'Eryn - Casual & Relatable', language: 'en-US', gender: 'female' },
    'alexandra': { id: 'kdmDKE6EkgrWrrykO9Qt', name: 'Alexandra - Super Realistic', language: 'en-US', gender: 'female' },
    'jessica': { id: 'g6xIsTj2HwM6VR4iXFCw', name: 'Jessica - Empathetic', language: 'en-US', gender: 'female' },
    'angela': { id: 'PT4nqlKZfc06VW1BuClj', name: 'Angela - Down to Earth', language: 'en-US', gender: 'female' },
    'hope': { id: 'OYTbf65OHHFELVut7v2H', name: 'Hope - Bright & Uplifting', language: 'en-US', gender: 'female' },
    'archer': { id: 'L0Dsvb3SLTyegXwtm47J', name: 'Archer - Friendly British', language: 'en-GB', gender: 'male' },
    'mark': { id: '1SM7GgM6IMuvQlz2BwM3', name: 'Mark - Relaxed', language: 'en-US', gender: 'male' },
    'finn': { id: 'vBKc2FfBKJfcZNyEt1n6', name: 'Finn - Light & Casual', language: 'en-US', gender: 'male' },
    'stuart': { id: 'HDA9tsk27wYi3uq0fPcK', name: 'Stuart - Aussie Professional', language: 'en-AU', gender: 'male' },
    // Standard voices
    'rachel': { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'en-US', gender: 'female' },
    'josh': { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'en-US', gender: 'male' },
    'adam': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'en-US', gender: 'male' },
    // British
    'charlie': { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', language: 'en-GB', gender: 'male' },
    'charlotte': { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', language: 'en-GB', gender: 'female' },
    'george': { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', language: 'en-GB', gender: 'male' },
    'daniel': { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel - Professional', language: 'en-GB', gender: 'male' }
};

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload for private key
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads', 'keys');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Serve generated audio files
app.get('/audio/:audioId.mp3', (req, res) => {
    const { audioId } = req.params;
    const cached = audioCache[audioId];
    
    if (!cached) {
        return res.status(404).json({ error: 'Audio not found or expired' });
    }
    
    res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': cached.buffer.length,
        'Cache-Control': 'no-cache'
    });
    res.send(cached.buffer);
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getBaseUrl(req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = (host && (host.includes('vcr') || host.includes('amazonaws') || host.includes('cloudfront')))
        ? 'https'
        : (req.get('x-forwarded-proto') || 'https');
    return `${proto}://${host}`;
}

function generateJWT(appId, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({
        application_id: appId,
        iat: now,
        exp: now + 3600,
        jti: Math.random().toString(36).substr(2, 9)
    }, privateKey, { algorithm: 'RS256' });
}

// Clean expired audio cache entries
function cleanAudioCache() {
    const now = Date.now();
    for (const [id, entry] of Object.entries(audioCache)) {
        if (now - entry.timestamp > AUDIO_CACHE_TTL) {
            delete audioCache[id];
        }
    }
}
setInterval(cleanAudioCache, 60000); // Clean every minute

/**
 * Generate audio using ElevenLabs API
 * @param {string} text - Text to synthesize
 * @param {string} elevenLabsApiKey - Client's ElevenLabs API key
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {object} settings - Voice settings (stability, similarity, etc.)
 * @param {string} baseUrl - Base URL for audio serving
 * @returns {string} URL to the generated audio
 */
async function generateElevenLabsAudio(text, elevenLabsApiKey, voiceId, settings, baseUrl) {
    const fetch = (await import('node-fetch')).default;
    
    const config = { ...DEFAULT_ELEVENLABS_CONFIG, ...settings };
    
    console.log('[ELEVENLABS] Generating audio:', { textLength: text.length, voiceId, model: config.model });
    
    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${config.outputFormat}`,
        {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': elevenLabsApiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: config.model,
                voice_settings: {
                    stability: config.stability,
                    similarity_boost: config.similarityBoost,
                    style: config.style,
                    use_speaker_boost: config.useSpeakerBoost
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.error('[ELEVENLABS] API error:', error);
        throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Collect audio buffer
    const chunks = [];
    for await (const chunk of response.body) {
        chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Cache the audio
    const audioId = 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    audioCache[audioId] = {
        buffer: audioBuffer,
        timestamp: Date.now()
    };

    console.log('[ELEVENLABS] Audio generated:', { audioId, size: audioBuffer.length });
    
    return `${baseUrl}/audio/${audioId}.mp3`;
}

/**
 * Create NCCO action for speech (uses ElevenLabs stream action)
 */
async function createSpeechNCCO(text, clientConfig, baseUrl) {
    if (!clientConfig || !clientConfig.elevenLabsApiKey) {
        throw new Error('ElevenLabs API key not configured');
    }

    const audioUrl = await generateElevenLabsAudio(
        text,
        clientConfig.elevenLabsApiKey,
        clientConfig.voiceId || ELEVENLABS_VOICES.rachel.id,
        {
            model: clientConfig.model,
            stability: clientConfig.stability,
            similarityBoost: clientConfig.similarityBoost,
            style: clientConfig.style,
            useSpeakerBoost: clientConfig.useSpeakerBoost
        },
        baseUrl
    );

    return {
        action: 'stream',
        streamUrl: [audioUrl],
        bargeIn: clientConfig.bargeIn || false
    };
}

// ==========================================
// HEALTH ENDPOINTS
// ==========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        vonageConfigured: !!vonageConfig,
        clientsConfigured: Object.keys(clientConfigs).length,
        activeCalls: Object.keys(activeCalls).length,
        environment: isVCR ? 'VCR' : 'local'
    });
});

app.get('/_/health', (req, res) => {
    res.status(200).send('OK');
});

// ==========================================
// VONAGE CONFIGURATION API
// ==========================================

/**
 * POST /api/vonage/config
 * Configure Vonage credentials (App ID + Private Key)
 * 
 * Body (multipart/form-data):
 *   - appId: Vonage Application ID
 *   - privateKey: Private key file (.key)
 *   - apiKey: (optional) Vonage API Key
 *   - apiSecret: (optional) Vonage API Secret
 */
app.post('/api/vonage/config', upload.single('privateKey'), async (req, res) => {
    try {
        const { appId, apiKey, apiSecret } = req.body;
        
        if (!appId || !req.file) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['appId', 'privateKey (file)']
            });
        }

        const privateKey = fs.readFileSync(req.file.path, 'utf8');

        // Validate the key by generating a JWT
        try {
            generateJWT(appId, privateKey);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid private key format' });
        }

        vonageConfig = {
            appId,
            privateKey,
            privateKeyPath: req.file.path,
            apiKey: apiKey || process.env.VONAGE_API_KEY,
            apiSecret: apiSecret || process.env.VONAGE_API_SECRET
        };

        console.log('[VONAGE] Configured with App ID:', appId);
        
        res.json({ 
            success: true, 
            appId,
            message: 'Vonage configuration saved successfully'
        });
    } catch (error) {
        console.error('[VONAGE CONFIG] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/vonage/config/status
 * Check Vonage configuration status
 */
app.get('/api/vonage/config/status', (req, res) => {
    res.json({
        configured: !!vonageConfig,
        appId: vonageConfig?.appId || null
    });
});

/**
 * DELETE /api/vonage/config
 * Clear Vonage configuration
 */
app.delete('/api/vonage/config', (req, res) => {
    vonageConfig = null;
    res.json({ success: true, message: 'Vonage configuration cleared' });
});

// ==========================================
// CLIENT CONFIGURATION API (ElevenLabs)
// ==========================================

/**
 * POST /api/client/config
 * Configure a client's ElevenLabs settings
 * 
 * Body (JSON):
 *   - clientId: Unique client identifier
 *   - elevenLabsApiKey: Client's ElevenLabs API key
 *   - voiceId: ElevenLabs voice ID (or alias from ELEVENLABS_VOICES)
 *   - model: (optional) ElevenLabs model ID
 *   - stability: (optional) 0-1
 *   - similarityBoost: (optional) 0-1
 *   - style: (optional) 0-1
 *   - useSpeakerBoost: (optional) boolean
 *   - bargeIn: (optional) Allow interruption
 *   - webhooks: (optional) { onCallStart, onCallEnd, onSpeech }
 */
app.post('/api/client/config', (req, res) => {
    const { 
        clientId, 
        elevenLabsApiKey, 
        voiceId,
        model,
        stability,
        similarityBoost,
        style,
        useSpeakerBoost,
        bargeIn,
        webhooks
    } = req.body;

    if (!clientId || !elevenLabsApiKey) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['clientId', 'elevenLabsApiKey']
        });
    }

    // Resolve voice alias to ID if needed
    let resolvedVoiceId = voiceId;
    if (voiceId && ELEVENLABS_VOICES[voiceId.toLowerCase()]) {
        resolvedVoiceId = ELEVENLABS_VOICES[voiceId.toLowerCase()].id;
    }

    clientConfigs[clientId] = {
        elevenLabsApiKey,
        voiceId: resolvedVoiceId || ELEVENLABS_VOICES.rachel.id,
        model: model || DEFAULT_ELEVENLABS_CONFIG.model,
        stability: stability ?? DEFAULT_ELEVENLABS_CONFIG.stability,
        similarityBoost: similarityBoost ?? DEFAULT_ELEVENLABS_CONFIG.similarityBoost,
        style: style ?? DEFAULT_ELEVENLABS_CONFIG.style,
        useSpeakerBoost: useSpeakerBoost ?? DEFAULT_ELEVENLABS_CONFIG.useSpeakerBoost,
        bargeIn: bargeIn || false,
        webhooks: webhooks || {},
        updatedAt: new Date().toISOString()
    };

    console.log('[CLIENT] Configured:', clientId);

    res.json({ 
        success: true, 
        clientId,
        config: {
            voiceId: clientConfigs[clientId].voiceId,
            model: clientConfigs[clientId].model,
            stability: clientConfigs[clientId].stability,
            similarityBoost: clientConfigs[clientId].similarityBoost
        }
    });
});

/**
 * GET /api/client/config/:clientId
 * Get client configuration
 */
app.get('/api/client/config/:clientId', (req, res) => {
    const config = clientConfigs[req.params.clientId];
    if (!config) {
        return res.status(404).json({ error: 'Client not found' });
    }
    
    // Don't expose the API key
    res.json({
        clientId: req.params.clientId,
        voiceId: config.voiceId,
        model: config.model,
        stability: config.stability,
        similarityBoost: config.similarityBoost,
        style: config.style,
        useSpeakerBoost: config.useSpeakerBoost,
        bargeIn: config.bargeIn,
        webhooks: config.webhooks,
        updatedAt: config.updatedAt,
        apiKeyConfigured: !!config.elevenLabsApiKey
    });
});

/**
 * DELETE /api/client/config/:clientId
 * Remove client configuration
 */
app.delete('/api/client/config/:clientId', (req, res) => {
    if (!clientConfigs[req.params.clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }
    delete clientConfigs[req.params.clientId];
    res.json({ success: true, message: 'Client configuration removed' });
});

/**
 * GET /api/voices
 * List available ElevenLabs voice presets
 */
app.get('/api/voices', (req, res) => {
    res.json({
        voices: Object.entries(ELEVENLABS_VOICES).map(([alias, voice]) => ({
            alias,
            ...voice
        })),
        note: 'You can use either the alias (e.g., "rachel") or the full voice ID when configuring'
    });
});

// ==========================================
// TEXT-TO-SPEECH API (Direct use)
// ==========================================

/**
 * POST /api/tts/generate
 * Generate speech audio from text
 * 
 * Body (JSON):
 *   - clientId: Client identifier (must be configured)
 *   - text: Text to synthesize
 *   - voiceId: (optional) Override configured voice
 * 
 * Returns: { audioUrl }
 */
app.post('/api/tts/generate', async (req, res) => {
    const { clientId, text, voiceId } = req.body;

    if (!clientId || !text) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['clientId', 'text']
        });
    }

    const config = clientConfigs[clientId];
    if (!config) {
        return res.status(404).json({ error: 'Client not configured' });
    }

    try {
        // Resolve voice alias if provided
        let useVoiceId = voiceId || config.voiceId;
        if (voiceId && ELEVENLABS_VOICES[voiceId.toLowerCase()]) {
            useVoiceId = ELEVENLABS_VOICES[voiceId.toLowerCase()].id;
        }

        const audioUrl = await generateElevenLabsAudio(
            text,
            config.elevenLabsApiKey,
            useVoiceId,
            config,
            getBaseUrl(req)
        );

        res.json({ 
            success: true,
            audioUrl,
            voiceId: useVoiceId,
            expiresIn: AUDIO_CACHE_TTL / 1000 + ' seconds'
        });
    } catch (error) {
        console.error('[TTS] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// VOICE CALL API
// ==========================================

/**
 * POST /api/call/outbound
 * Initiate an outbound call with ElevenLabs TTS
 * 
 * Body (JSON):
 *   - clientId: Client identifier (must be configured)
 *   - to: Destination phone number (E.164 format)
 *   - from: Vonage number to call from
 *   - text: Initial text to speak
 *   - ncco: (optional) Full NCCO array to execute after initial speech
 */
app.post('/api/call/outbound', async (req, res) => {
    if (!vonageConfig) {
        return res.status(401).json({ error: 'Vonage not configured' });
    }

    const { clientId, to, from, text, ncco: additionalNcco } = req.body;

    if (!clientId || !to || !from) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['clientId', 'to', 'from']
        });
    }

    const config = clientConfigs[clientId];
    if (!config) {
        return res.status(404).json({ error: 'Client not configured' });
    }

    try {
        const vonage = new Vonage({
            applicationId: vonageConfig.appId,
            privateKey: vonageConfig.privateKey
        });

        const baseUrl = getBaseUrl(req);
        const callId = 'call-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

        // Build NCCO
        let ncco = [];

        // Add initial speech if provided
        if (text) {
            const speechAction = await createSpeechNCCO(text, config, baseUrl);
            ncco.push(speechAction);
        }

        // Add additional NCCO actions
        if (additionalNcco && Array.isArray(additionalNcco)) {
            ncco = ncco.concat(additionalNcco);
        }

        // Add default input action if no NCCO provided
        if (ncco.length === 0 || (ncco.length === 1 && text)) {
            ncco.push({
                action: 'input',
                type: ['speech'],
                eventUrl: [`${baseUrl}/voice/webhooks/input?callId=${callId}&clientId=${clientId}`],
                eventMethod: 'POST',
                speech: {
                    language: 'en-US',
                    endOnSilence: 2,
                    maxDuration: 30,
                    startTimeout: 10
                }
            });
        }

        // Store call state
        activeCalls[callId] = {
            clientId,
            to,
            from,
            startTime: Date.now(),
            status: 'initiating'
        };

        // Make the call
        const response = await vonage.voice.createOutboundCall({
            to: [{ type: 'phone', number: to }],
            from: { type: 'phone', number: from },
            ncco: ncco,
            eventUrl: [`${baseUrl}/voice/webhooks/events?callId=${callId}&clientId=${clientId}`],
            eventMethod: 'POST'
        });

        if (response.uuid) {
            activeCalls[response.uuid] = activeCalls[callId];
            activeCalls[callId].uuid = response.uuid;
        }

        console.log('[CALL] Initiated:', { callId, uuid: response.uuid, to, from });

        // Trigger client webhook if configured
        if (config.webhooks?.onCallStart) {
            triggerWebhook(config.webhooks.onCallStart, {
                event: 'call_start',
                callId,
                uuid: response.uuid,
                to,
                from
            });
        }

        res.json({
            success: true,
            callId,
            uuid: response.uuid,
            to,
            from
        });
    } catch (error) {
        console.error('[CALL] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/call/:callId/speak
 * Send TTS to an active call
 */
app.post('/api/call/:callId/speak', async (req, res) => {
    if (!vonageConfig) {
        return res.status(401).json({ error: 'Vonage not configured' });
    }

    const { callId } = req.params;
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    const call = activeCalls[callId];
    if (!call) {
        return res.status(404).json({ error: 'Call not found' });
    }

    const config = clientConfigs[call.clientId];
    if (!config) {
        return res.status(404).json({ error: 'Client not configured' });
    }

    try {
        const audioUrl = await generateElevenLabsAudio(
            text,
            config.elevenLabsApiKey,
            config.voiceId,
            config,
            getBaseUrl(req)
        );

        const vonage = new Vonage({
            applicationId: vonageConfig.appId,
            privateKey: vonageConfig.privateKey
        });

        await vonage.voice.streamAudio(call.uuid, audioUrl);

        res.json({ success: true, audioUrl });
    } catch (error) {
        console.error('[SPEAK] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/calls/active
 * List active calls
 */
app.get('/api/calls/active', (req, res) => {
    const calls = Object.entries(activeCalls).map(([id, call]) => ({
        callId: id,
        uuid: call.uuid,
        clientId: call.clientId,
        to: call.to,
        from: call.from,
        startTime: call.startTime,
        duration: Math.round((Date.now() - call.startTime) / 1000),
        status: call.status
    }));
    res.json(calls);
});

// ==========================================
// VOICE WEBHOOKS
// ==========================================

/**
 * GET/POST /voice/webhooks/answer
 * Answer webhook for inbound calls
 */
app.all('/voice/webhooks/answer', async (req, res) => {
    const params = req.method === 'GET' ? req.query : req.body;
    const { clientId } = params;
    
    console.log('[WEBHOOK] Answer:', params);

    // If clientId provided, use their config for greeting
    if (clientId && clientConfigs[clientId]) {
        const config = clientConfigs[clientId];
        try {
            const speechAction = await createSpeechNCCO(
                config.greeting || 'Hello, how can I help you?',
                config,
                getBaseUrl(req)
            );
            return res.json([
                speechAction,
                {
                    action: 'input',
                    type: ['speech'],
                    eventUrl: [`${getBaseUrl(req)}/voice/webhooks/input?clientId=${clientId}`],
                    eventMethod: 'POST',
                    speech: {
                        language: 'en-US',
                        endOnSilence: 2,
                        maxDuration: 30
                    }
                }
            ]);
        } catch (error) {
            console.error('[ANSWER] Error:', error.message);
        }
    }

    // Default response
    res.json([{
        action: 'talk',
        text: 'Hello. This line is configured for the ElevenLabs Vonage integration.',
        language: 'en-US'
    }]);
});

/**
 * POST /voice/webhooks/events
 * Events webhook for call status updates
 */
app.post('/voice/webhooks/events', async (req, res) => {
    const { callId, clientId } = req.query;
    const event = req.body;

    console.log('[WEBHOOK] Event:', event.status, event.uuid);

    const call = activeCalls[callId] || activeCalls[event.uuid];
    
    if (call) {
        call.status = event.status;

        // Handle call completion
        if (['completed', 'failed', 'rejected', 'busy', 'timeout'].includes(event.status)) {
            const config = clientConfigs[call.clientId];
            
            // Trigger client webhook
            if (config?.webhooks?.onCallEnd) {
                triggerWebhook(config.webhooks.onCallEnd, {
                    event: 'call_end',
                    callId,
                    uuid: event.uuid,
                    status: event.status,
                    duration: Math.round((Date.now() - call.startTime) / 1000)
                });
            }

            // Cleanup
            delete activeCalls[callId];
            delete activeCalls[event.uuid];
        }
    }

    res.sendStatus(200);
});

/**
 * POST /voice/webhooks/input
 * Input webhook for speech recognition results
 */
app.post('/voice/webhooks/input', async (req, res) => {
    const { callId, clientId } = req.query;
    const { uuid, speech } = req.body;

    console.log('[WEBHOOK] Input:', { callId, clientId, uuid });

    const call = activeCalls[callId] || activeCalls[uuid];
    const config = clientConfigs[clientId || call?.clientId];

    if (!config) {
        return res.json([{
            action: 'talk',
            text: 'Configuration error. Goodbye.',
            language: 'en-US'
        }]);
    }

    // Extract speech
    let userSpeech = '';
    if (speech?.results?.length > 0) {
        userSpeech = speech.results[0].text || '';
    }

    console.log('[SPEECH] User said:', userSpeech);

    // Trigger client webhook
    if (config.webhooks?.onSpeech) {
        triggerWebhook(config.webhooks.onSpeech, {
            event: 'speech',
            callId,
            uuid,
            text: userSpeech
        });
    }

    // Default: acknowledge and wait for more input
    // Client should use their webhook to determine response
    try {
        const speechAction = await createSpeechNCCO(
            userSpeech ? "I heard you. Please wait." : "I didn't catch that. Please try again.",
            config,
            getBaseUrl(req)
        );

        res.json([
            speechAction,
            {
                action: 'input',
                type: ['speech'],
                eventUrl: [`${getBaseUrl(req)}/voice/webhooks/input?callId=${callId}&clientId=${clientId}`],
                eventMethod: 'POST',
                speech: {
                    language: 'en-US',
                    endOnSilence: 2,
                    maxDuration: 30
                }
            }
        ]);
    } catch (error) {
        console.error('[INPUT] Error:', error.message);
        res.json([{
            action: 'talk',
            text: 'Technical error. Please try again.',
            language: 'en-US'
        }]);
    }
});

// Trigger client webhook (fire-and-forget)
async function triggerWebhook(url, payload) {
    try {
        const fetch = (await import('node-fetch')).default;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => console.error('[WEBHOOK] Failed:', e.message));
    } catch (error) {
        console.error('[WEBHOOK] Error:', error.message);
    }
}

// ==========================================
// NCCO BUILDER API
// ==========================================

/**
 * POST /api/ncco/build
 * Build an NCCO with ElevenLabs TTS actions
 * 
 * Body (JSON):
 *   - clientId: Client identifier
 *   - actions: Array of action definitions
 *     - { type: 'speak', text: '...' }
 *     - { type: 'input', options: {...} }
 *     - { type: 'connect', endpoint: {...} }
 *     - etc.
 * 
 * Returns: { ncco: [...] }
 */
app.post('/api/ncco/build', async (req, res) => {
    const { clientId, actions } = req.body;

    if (!clientId || !actions || !Array.isArray(actions)) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['clientId', 'actions (array)']
        });
    }

    const config = clientConfigs[clientId];
    if (!config) {
        return res.status(404).json({ error: 'Client not configured' });
    }

    try {
        const ncco = [];
        const baseUrl = getBaseUrl(req);

        for (const action of actions) {
            switch (action.type) {
                case 'speak':
                    const speechAction = await createSpeechNCCO(action.text, config, baseUrl);
                    ncco.push(speechAction);
                    break;
                case 'input':
                    ncco.push({
                        action: 'input',
                        type: action.inputType || ['speech'],
                        eventUrl: action.eventUrl || [`${baseUrl}/voice/webhooks/input?clientId=${clientId}`],
                        eventMethod: 'POST',
                        speech: action.speech || {
                            language: 'en-US',
                            endOnSilence: 2,
                            maxDuration: 30
                        }
                    });
                    break;
                case 'connect':
                    ncco.push({
                        action: 'connect',
                        endpoint: action.endpoint,
                        from: action.from
                    });
                    break;
                case 'notify':
                    ncco.push({
                        action: 'notify',
                        payload: action.payload,
                        eventUrl: action.eventUrl,
                        eventMethod: action.eventMethod || 'POST'
                    });
                    break;
                case 'record':
                    ncco.push({
                        action: 'record',
                        eventUrl: action.eventUrl,
                        format: action.format || 'mp3',
                        beepStart: action.beepStart || false
                    });
                    break;
                default:
                    // Pass through as-is for other NCCO actions
                    ncco.push(action);
            }
        }

        res.json({ success: true, ncco });
    } catch (error) {
        console.error('[NCCO BUILD] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🎤 ElevenLabs + Vonage Voice Integration                            ║
║                                                                       ║
║   Server: http://${HOST}:${PORT}                                          ║
║   Environment: ${isVCR ? 'VCR Cloud Runtime' : 'Local/Standard'}                                      ║
║                                                                       ║
║   API Endpoints:                                                      ║
║   • POST /api/vonage/config     - Configure Vonage credentials        ║
║   • POST /api/client/config     - Configure client ElevenLabs         ║
║   • POST /api/tts/generate      - Generate TTS audio                  ║
║   • POST /api/call/outbound     - Make outbound call                  ║
║   • POST /api/ncco/build        - Build NCCO with ElevenLabs          ║
║                                                                       ║
║   Voice Webhooks:                                                     ║
║   • /voice/webhooks/answer                                            ║
║   • /voice/webhooks/events                                            ║
║   • /voice/webhooks/input                                             ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
    `);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
