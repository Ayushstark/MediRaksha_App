import { pool } from '../config/db.js';

const groqJson = async (systemPrompt, userPrompt) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || 'Groq request failed');
  }

  return JSON.parse(body.choices[0].message.content);
};

export const chatWithAssistant = async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ success: false, message: 'GROQ_API_KEY is not configured' });
  }

  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history.slice(-10).flatMap((item) => {
        const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
        const content = String(item?.content || '').trim().slice(0, 2000);
        return role && content ? [{ role, content }] : [];
      })
    : [];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are MediRaksha, a cautious conversational healthcare triage assistant.
Use clinical reasoning internally to guide patient inquiry without mentioning specific protocol names.
Respond naturally to the patient's symptoms and history. Ask only one concise, relevant follow-up question at a time.
If red flag symptoms or emergencies arise, immediately advise seeking emergency medical attention.
Do not diagnose, prescribe medication, or claim certainty. Keep responses supportive, brief, and empathetic.`,
          },
          ...history,
          { role: 'user', content: message },
        ],
        max_tokens: 250,
        temperature: 0.3,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      return res.status(502).json({ success: false, message: body.error?.message || 'AI service failure' });
    }

    return res.json({ success: true, response: body.choices[0].message.content });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
};

export const classifySymptom = async (req, res) => {
  const labels = Array.isArray(req.body.candidateLabels) ? req.body.candidateLabels.filter(Boolean) : [];
  const text = String(req.body.text || '').trim();

  if (!text || !labels.length) {
    return res.status(400).json({ success: false, message: 'Text and candidateLabels are required' });
  }

  try {
    const result = await groqJson(
      `Choose exactly one medical specialty from this list and return JSON with only a "label" field: ${labels.join(', ')}`,
      text
    );
    const label = labels.find((item) => item.toLowerCase() === String(result.label || '').toLowerCase()) || 'General';
    return res.json({ success: true, label });
  } catch {
    const matchingLabel = labels.find((l) => text.toLowerCase().includes(l.toLowerCase()));
    return res.json({
      success: true,
      label: matchingLabel || labels.find((l) => l.toLowerCase() === 'general') || labels[0],
      aiAvailable: false,
    });
  }
};

export const analyzeReport = async (req, res) => {
  const reportId = req.body.fileId || req.body.reportId;
  if (!reportId) {
    return res.status(400).json({ success: false, message: 'reportId or fileId is required' });
  }

  try {
    const reportRes = await pool.query(
      `SELECT r.* FROM "Report" r WHERE r.id = $1`,
      [reportId]
    );

    const report = reportRes.rows[0];
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Check cached analysis
    const cachedRes = await pool.query(
      `SELECT result FROM report_analyses WHERE report_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [String(report.id)]
    );

    if (cachedRes.rows.length && !req.body.refresh) {
      return res.json({ success: true, data: cachedRes.rows[0].result });
    }

    let result;
    try {
      result = await groqJson(
        'You are a cautious medical report assistant. Return JSON with "history" as a concise summary and "mandatory_care" as an array of recommendations. State limitations clearly. Do not diagnose or prescribe.',
        `Report metadata: Title: ${report.title}; Filename: ${report.originalFileName || 'N/A'}; Category: ${report.category}; Notes: ${report.notes || 'None'}.`
      );
    } catch {
      result = {
        history: `Report summary: ${report.title} (${report.category || 'General'}). Complete lab telemetry should be verified by a licensed clinician.`,
        mandatory_care: ['Have a qualified physician or specialist examine the original physical document.'],
        aiAvailable: false,
      };
    }

    await pool.query(
      `INSERT INTO report_analyses (report_id, requested_by, result) VALUES ($1, $2, $3)`,
      [String(report.id), String(req.user?.id || 'unknown'), JSON.stringify(result)]
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('analyzeReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error analyzing report' });
  }
};
