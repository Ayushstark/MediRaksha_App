import axios from 'axios';

const HF_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";
const HF_TOKEN = process.env.EXPO_PUBLIC_HUGGINGFACE_TOKEN || "";

const getAuthHeaders = () => (
    HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : undefined
);

export const classifySymptom = async (text: string, candidateLabels: string[]) => {
    try {
        const response = await axios.post(
            HF_API_URL,
            {
                inputs: text,
                parameters: { candidate_labels: candidateLabels }
            },
            { headers: getAuthHeaders() }
        );
        return { label: response.data.labels[0] };
    } catch (error) {
        console.error("HF Error:", error);
        return { label: "General" };
    }
};
export const chatWithAssistantLLM = async (message: string) => {
    try {
        const response = await axios.post(
            "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
            { inputs: message },
            { headers: getAuthHeaders() }
        );
        return response.data?.generated_text || response.data[0]?.generated_text || "I'm sorry, I couldn't process that.";
    } catch (error) {
        console.error("Chat Error:", error);
        return "Assistant is currently offline. Please try again later.";
    }
};
